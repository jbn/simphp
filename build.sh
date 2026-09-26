#!/usr/bin/env bash
# Build the original, unmodified PHP 4.1.1 sources (CGI SAPI) to WebAssembly.
#
#   ./build.sh            # full build (fetch, configure, make, link)
#   ./build.sh link       # only relink web/php.js + web/php.wasm
#
# Requirements: git, curl, python3, make. Emscripten is installed locally into
# tools/emsdk on first run.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PHP_VER=4.1.1
TARBALL="$ROOT/php-$PHP_VER.tar.gz"
SRC="$ROOT/build/php-$PHP_VER"
OUT="$ROOT/web"
EMSDK="$ROOT/tools/emsdk"

# --- toolchain ---------------------------------------------------------------
if [ ! -x "$EMSDK/upstream/emscripten/emcc" ]; then
  git clone --depth 1 https://github.com/emscripten-core/emsdk.git "$EMSDK"
  (cd "$EMSDK" && ./emsdk install latest && ./emsdk activate latest)
fi
# shellcheck disable=SC1091
source "$EMSDK/emsdk_env.sh" >/dev/null 2>&1

# Compile flags. The 2001 sources predate C99 strictness and -fno-common, so we
# relax modern clang's defaults rather than touching the code.
#  -fwrapv -fno-strict-aliasing: 2001-era gcc did not exploit signed overflow
#     or aliasing UB, and PHP 4 relies on wrapping arithmetic in places.
#  -ftrivial-auto-var-init=zero: PHP 4 reads uninitialized locals in places
#     (e.g. mysql_select_db() with the default link); gcc 2.95 just used stack
#     garbage, but clang optimizes such undef values into incoherent code.
#  -mno-nontrapping-fptoint: out-of-range double->int conversions yield
#     INT_MIN like x86's cvttsd2si/fistp, instead of saturating.
#  setjmp/longjmp (zend_bailout) uses native wasm exception handling.
CFLAGS_COMMON="-O2 -fcommon -fwrapv -fno-strict-aliasing -ftrivial-auto-var-init=zero -mno-nontrapping-fptoint -sSUPPORT_LONGJMP=wasm \
  -Wno-error -Wno-implicit-function-declaration -Wno-int-conversion \
  -Wno-incompatible-pointer-types -Wno-implicit-int -Wno-return-type \
  -Wno-deprecated-non-prototype -Wno-everything"

build_php() {
  [ -f "$TARBALL" ] || curl -fsSL -o "$TARBALL" "https://museum.php.net/php4/php-$PHP_VER.tar.gz"
  rm -rf "$SRC" && mkdir -p "$ROOT/build"
  tar xzf "$TARBALL" -C "$ROOT/build"

  for p in "$ROOT"/patches/*.patch; do
    [ -e "$p" ] || continue
    echo "applying $(basename "$p")"
    patch -d "$SRC" -p1 < "$p"
  done

  # configure bakes `uname` into PHP_OS / php_uname(). Report the kind of box
  # PHP 4.1.1 actually shipped on (i686 Linux, Dec 2001) instead of the build host.
  local fakebin="$ROOT/build/fakebin"
  mkdir -p "$fakebin"
  cat > "$fakebin/uname" <<'EOF'
#!/bin/sh
case "$1" in
  -a) echo "Linux simphp 2.4.16 #1 Fri Dec 21 12:00:00 PST 2001 i686 unknown";;
  -m) echo "i686";;
  -r) echo "2.4.16";;
  -n) echo "simphp";;
  -s|"") echo "Linux";;
  *) echo "Linux";;
esac
EOF
  chmod +x "$fakebin/uname"

  cd "$SRC"
  # Autoconf results that must match a glibc i686 box but can't be detected
  # under emscripten: musl implements isnan/isinf as macros (link tests fail),
  # glibc of the era had no strlcpy/strlcat (PHP uses its bundled copies), the
  # fflush-between-read-and-write test can't run, and res_search is stubbed
  # (see src/simphp_sys.c) so checkdnsrr()/getmxrr() exist as on Linux.
  export ac_cv_func_isnan=yes ac_cv_func_isinf=yes \
         ac_cv_func_strlcpy=no ac_cv_func_strlcat=no \
         ac_cv_flush_io=no ac_cv_func_res_search=yes \
         ac_cv_func_cuserid=yes ac_cv_func_getwd=yes
  PATH="$fakebin:$PATH" CFLAGS="$CFLAGS_COMMON" emconfigure ./configure \
    --host=i686-pc-linux-gnu --build=i686-pc-linux-gnu \
    --disable-shared --enable-static --without-pear \
    --with-config-file-path=/etc \
    --with-regex=php \
    --with-mysql --disable-posix \
    --enable-bcmath --enable-calendar --enable-ctype \
    --enable-wddx \
    > "$ROOT/build/configure.log" 2>&1 || { tail -40 "$ROOT/build/configure.log"; exit 1; }

  # The in-tree link of the `php` target fails (it lacks our JS library and
  # simphp_sys.o); we only need the objects, and link ourselves in link_php.
  # simphp_force.h is force-included into every PHP source at make time only
  # (so configure's link tests are unaffected): errno display in Linux
  # numbering, and a few libc functions redirected to glibc-compatible ones.
  emmake make -j"$(sysctl -n hw.ncpu 2>/dev/null || nproc)" \
    CPPFLAGS='-I$(top_builddir)/TSRM -include '"$ROOT/src/simphp_force.h" \
    > "$ROOT/build/make.log" 2>&1 || true
  if [ ! -f .libs/libphp4.a ] || [ ! -f stub.o ]; then
    grep -E "error" "$ROOT/build/make.log" | head -40; exit 1
  fi
}

link_php() {
  cd "$SRC"
  mkdir -p "$OUT"
  emcc $CFLAGS_COMMON -I"$ROOT/src" -c "$ROOT/src/simphp_sys.c" -o "$ROOT/build/simphp_sys.o"
  local common=(
    $CFLAGS_COMMON stub.o "$ROOT/build/simphp_sys.o" .libs/libphp4.a -lm
    -sMODULARIZE=1 -sEXPORT_NAME=createPHP
    -sINVOKE_RUN=0 -sEXIT_RUNTIME=1
    -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=32MB -sMAXIMUM_MEMORY=512MB
    -sSTACK_SIZE=8MB -Wl,--stack-first
    -sFORCE_FILESYSTEM=1
    -sEXPORTED_RUNTIME_METHODS=callMain,FS,ENV
    -sENVIRONMENT=web,worker,node
    --js-library "$ROOT/src/simphp_lib.js"
    --js-library "$ROOT/src/simphp_shell.js"
  )
  # Plain build: every browser, and Node (tests, bin/php411.js).
  emcc "${common[@]}" -o "$OUT/php.js"
  # JSPI build: main() runs on a separate, larger wasm stack. Zend 1 recurses
  # in C for each PHP-level call, so this roughly doubles the usable PHP
  # recursion depth in browsers that support JS Promise Integration.
  emcc "${common[@]}" -sJSPI -sJSPI_EXPORTS=main,__main_argc_argv -o "$OUT/php-jspi.js"
  ls -la "$OUT"/php.js "$OUT"/php.wasm "$OUT"/php-jspi.js "$OUT"/php-jspi.wasm
}

case "${1:-all}" in
  link) link_php ;;
  all) build_php; link_php ;;
  *) echo "usage: $0 [all|link]"; exit 2 ;;
esac

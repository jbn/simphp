# A real MySQL 3.23.49 server (the version web/mysqld.js reports), used as the
# ground truth for tests/mysql-difftest.js.
#
# Stage 1 builds mysqld from the pristine 3.23.49 sources, linked statically
# the way MySQL AB's binary tarballs were. The build runs on Debian 4.0 "etch"
# (i386) with gcc 3.3: it needs NPTL threads, because the LinuxThreads of the
# 2002 distros can't start threads under qemu user emulation (Docker on arm64
# hosts), and it is the oldest Debian with a static NPTL libc.
# Stage 2 adds it to the native PHP 4.1.1 image (reference/Dockerfile), so one
# container runs both and PHP talks to mysqld over /tmp/mysql.sock.
#
#   docker build --platform linux/386 -t simphp-reference reference
#   docker build --provenance=false --platform linux/386 -t simphp-mysql-reference -f reference/mysql.Dockerfile reference
# (--provenance=false: Docker 24's BuildKit panics resolving a local base image.)
#
# mysql-3.23.49.tar.gz is Debian's mysql_3.23.49.orig.tar.gz (upstream source),
# sha1 ebf7289d50fbd8876f0b101d432cf2db04f598d6:
#   curl -L -o reference/mysql-3.23.49.tar.gz \
#     https://snapshot.debian.org/file/ebf7289d50fbd8876f0b101d432cf2db04f598d6
FROM --platform=linux/386 debian/eol:etch AS mysqld
# The 32-bit readdir() of old glibcs fails with EOVERFLOW on overlayfs (64-bit
# inode numbers), so everything that lists directories runs on tmpfs.
RUN --mount=type=tmpfs,target=/var/lib/dpkg/updates apt-get update \
 && apt-get install -y gcc-3.3 g++-3.3 make libncurses5-dev zlib1g-dev && rm -rf /var/lib/apt/lists/*
COPY mysql-3.23.49.tar.gz /src/
# - my_sys.h declares `extern int errno`, which a TLS errno rejects (as in
#   reference/Dockerfile);
# - sql/Makefile.in lists InnoDB/BDB headers as dependencies although both are
#   configured out: empty stand-ins satisfy make;
# - static NPTL lives in /usr/include/nptl and /usr/lib/nptl;
# - flags from MySQL AB's BUILD/compile-pentium, linking with g++ for gcc 3's
#   C++ runtime (__cxa_pure_virtual).
RUN --mount=type=tmpfs,target=/build cd /build && tar xzf /src/mysql-3.23.49.tar.gz && cd mysql-3.23.49.orig \
 && sed -i 's/^#ifdef HAVE_ERRNO_AS_DEFINE/#if 1/' include/my_sys.h \
 && mkdir -p bdb/build_unix && touch innobase/ib_config.h bdb/build_unix/db.h \
 && CC=gcc-3.3 CFLAGS="-O3 -mcpu=pentiumpro" CXX=g++-3.3 CXXFLAGS="-O3 -mcpu=pentiumpro -felide-constructors -fno-exceptions -fno-rtti" \
    CPPFLAGS="-I/usr/include/nptl" LDFLAGS="-L/usr/lib/nptl" \
    ./configure --prefix=/usr/local/mysql --localstatedir=/usr/local/mysql/data \
    --with-unix-socket-path=/tmp/mysql.sock --with-charset=latin1 --enable-assembler \
    --with-mysqld-ldflags=-all-static --with-client-ldflags=-all-static \
    --without-bench --without-docs --without-debug --disable-shared \
 && make -j8 && make install \
 && mkdir /build/data && ./scripts/mysql_install_db --basedir=/usr/local/mysql --ldata=/build/data --user=root \
 && cp -a /build/data /usr/local/mysql/data \
 && /usr/local/mysql/libexec/mysqld --version

FROM simphp-reference
COPY --from=mysqld /usr/local/mysql /usr/local/mysql
# mysqld runs as root in a throwaway container. Its datadir must be on tmpfs
# (the readdir() problem above): tests copy /usr/local/mysql/data to
# /tmp/mysql-data and start mysqld there.
RUN printf '[mysqld]\nuser=root\nskip-networking\nsocket=/tmp/mysql.sock\ndatadir=/tmp/mysql-data\nbasedir=/usr/local/mysql\n' > /etc/my.cnf \
 && /usr/local/mysql/libexec/mysqld --version

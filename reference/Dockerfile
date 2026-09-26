# Native PHP 4.1.1 CGI on i386 Linux (glibc), used as the ground truth for
# differential testing of the wasm build. Same configure flags as build.sh.
FROM --platform=linux/386 debian:bookworm
RUN apt-get update && apt-get install -y --no-install-recommends gcc make libc6-dev patch file locales flex bison \
 && rm -rf /var/lib/apt/lists/* \
 && sed -i 's/^# *\(en_US ISO-8859-1\)/\1/; s/^# *\(de_DE ISO-8859-1\)/\1/; s/^# *\(en_US.UTF-8\)/\1/' /etc/locale.gen && locale-gen
COPY php-4.1.1.tar.gz /src/
RUN cd /src && tar xzf php-4.1.1.tar.gz && cd php-4.1.1 \
 # old libmysql declares `extern int errno`, which modern glibc (TLS errno) rejects
 && sed -i 's/^#ifdef HAVE_ERRNO_AS_DEFINE/#if 1/' ext/mysql/libmysql/my_sys.h \
 && CFLAGS="-O2 -fcommon -fwrapv -fno-strict-aliasing -std=gnu89 -w" ./configure \
    --disable-shared --enable-static --without-pear --with-config-file-path=/etc \
    --with-regex=php --with-mysql --disable-posix \
    --enable-bcmath --enable-calendar --enable-ctype --enable-wddx \
 && make -j8 && cp php /usr/local/bin/php && (php -v || true)

/*
 * Force-included (-include) into every PHP 4.1.1 source file of the wasm build.
 * Redirects libc functions whose musl behavior differs visibly from the glibc
 * of an i686 Linux box to the replacements in simphp_sys.c.
 */
#ifndef SIMPHP_FORCE_H
#define SIMPHP_FORCE_H

#include "simphp_errno.h"

#include <time.h>
/* glibc strftime: GNU flags/widths, unknown conversions copied literally */
size_t simphp_strftime(char *s, size_t max, const char *fmt, const struct tm *tm);
#define strftime(s, max, fmt, tm) simphp_strftime((s), (max), (fmt), (tm))

#endif

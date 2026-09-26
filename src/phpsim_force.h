/*
 * Force-included (-include) into every PHP 4.1.1 source file of the wasm build.
 * Redirects libc functions whose musl behavior differs visibly from the glibc
 * of an i686 Linux box to the replacements in phpsim_sys.c.
 */
#ifndef PHPSIM_FORCE_H
#define PHPSIM_FORCE_H

#include "phpsim_errno.h"

#include <time.h>
/* glibc strftime: GNU flags/widths, unknown conversions copied literally */
size_t phpsim_strftime(char *s, size_t max, const char *fmt, const struct tm *tm);
#define strftime(s, max, fmt, tm) phpsim_strftime((s), (max), (fmt), (tm))

#endif

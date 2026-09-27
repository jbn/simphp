/*
 * simphp: small libc replacements linked ahead of emscripten's libc.
 */
#include <time.h>
#include <errno.h>
#include <stdint.h>
#include <sys/types.h>
#include <netdb.h>
#include <stdlib.h>
#include <string.h>

/* Implemented in simphp_lib.js: blocks for `ms` and records it as sleeping
 * time, so it is excluded from CPU time (max_execution_time), as on Linux. */
extern void simphp_sleep_ms(double ms);

int nanosleep(const struct timespec *req, struct timespec *rem)
{
	if (req->tv_nsec < 0 || req->tv_nsec >= 1000000000L || req->tv_sec < 0) {
		errno = EINVAL;
		return -1;
	}
	simphp_sleep_ms(req->tv_sec * 1000.0 + req->tv_nsec / 1e6);
	if (rem) {
		rem->tv_sec = 0;
		rem->tv_nsec = 0;
	}
	return 0;
}

/*
 * glibc's random()/srandom() (TYPE_3: x**31 + x**3 + 1 additive feedback).
 * PHP 4.1.1's rand()/srand() map to these, and 4.1.x does not auto-seed, so
 * scripts relied on glibc's exact sequence (1804289383, 846930886, ...).
 * musl's generator produces different numbers.
 */
#define GLIBC_DEG 31
#define GLIBC_SEP 3

static int32_t glibc_state[GLIBC_DEG];
static int glibc_f, glibc_r, glibc_seeded;

static int32_t glibc_random_step(void)
{
	uint32_t *s = (uint32_t *) glibc_state;
	int32_t result;

	s[glibc_f] += s[glibc_r];
	result = (s[glibc_f] >> 1) & 0x7fffffff;
	if (++glibc_f >= GLIBC_DEG) glibc_f = 0;
	if (++glibc_r >= GLIBC_DEG) glibc_r = 0;
	return result;
}

void srandom(unsigned int seed)
{
	int i;
	int32_t word;

	if (seed == 0) seed = 1;
	glibc_state[0] = (int32_t) seed;
	for (i = 1; i < GLIBC_DEG; i++) {
		/* 16807 * state[i-1] % 2147483647 without overflow (Schrage) */
		long hi = glibc_state[i - 1] / 127773;
		long lo = glibc_state[i - 1] % 127773;
		word = 16807 * lo - 2836 * hi;
		if (word < 0) word += 2147483647;
		glibc_state[i] = word;
	}
	glibc_f = GLIBC_SEP;
	glibc_r = 0;
	glibc_seeded = 1;
	for (i = 0; i < GLIBC_DEG * 10; i++) glibc_random_step();
}

long random(void)
{
	if (!glibc_seeded) srandom(1);
	return glibc_random_step();
}

void srand(unsigned int seed) { srandom(seed); }
int rand(void) { return (int) random(); }

/*
 * glibc's qsort() is a merge sort (msort.c): stable, and with a specific
 * comparator call order. PHP 4.1.1's sort()/usort()/ksort()... hand their
 * arrays to libc qsort, so elements that compare equal keep their original
 * order on Linux -- musl's smoothsort would shuffle them. Same algorithm here.
 */
static void glibc_msort(char *b, size_t n, size_t s, int (*cmp)(const void *, const void *), char *t)
{
	char *tmp, *b1, *b2;
	size_t n1, n2;

	if (n <= 1) return;

	n1 = n / 2;
	n2 = n - n1;
	b1 = b;
	b2 = b + n1 * s;

	glibc_msort(b1, n1, s, cmp, t);
	glibc_msort(b2, n2, s, cmp, t);

	tmp = t;
	while (n1 > 0 && n2 > 0) {
		if ((*cmp)(b1, b2) <= 0) {
			memcpy(tmp, b1, s); tmp += s; b1 += s; --n1;
		} else {
			memcpy(tmp, b2, s); tmp += s; b2 += s; --n2;
		}
	}
	if (n1 > 0) memcpy(tmp, b1, n1 * s);
	memcpy(b, t, (n - n2) * s);
}

void qsort(void *base, size_t n, size_t s, int (*cmp)(const void *, const void *))
{
	char buf[1024];
	size_t size = n * s;
	char *t = size < sizeof(buf) ? buf : malloc(size);

	if (!t) return;
	glibc_msort((char *) base, n, s, cmp, t);
	if (t != buf) free(t);
}

/*
 * x87 extended precision helpers. PHP 4.1.1 was built for i386, where gcc
 * keeps floating point intermediates in 80-bit registers (64-bit significand).
 * long double is IEEE quad on wasm, wide enough to compute exactly and then
 * round to the x87 significand width.
 */
#include <math.h>

static long double x87(long double x)
{
	int e;
	long double m;

	if (x == 0 || isinf(x) || isnan(x)) return x;
	m = frexpl(x, &e);          /* 0.5 <= |m| < 1 */
	m = rintl(ldexpl(m, 64));   /* keep 64 significant bits, nearest-even */
	return ldexpl(m, e - 64);
}

/* glibc's i386 pow() (e_pow.S) for an integer exponent: square-and-multiply
 * in x87 registers, taking 1/x first for negative exponents. */
static long double x87_pow10i(int y)
{
	long double x = 10.0L, r = 1.0L;
	unsigned int n = y < 0 ? -(unsigned int) y : (unsigned int) y;

	if (y < 0) x = x87(1.0L / x);
	while (n) {
		if (n & 1) r = x87(r * x);
		x = x87(x * x);
		n >>= 1;
	}
	return r;
}

/* PHP 4.1.1 round() as compiled by gcc -O2 for i386:
 *   v = value * f; v = v >= 0 ? floor(v + 0.5) : ceil(v - 0.5); v /= f;
 * all in extended precision, rounded to double only at the end. */
double simphp_x87_round(double value, int places)
{
	long double f;

	if (value != value) return value;   /* NaN passes through frndint unchanged */
	f = x87_pow10i(places);
	{
	long double v = x87((long double) value * f);

	if (v >= 0.0L) v = floorl(x87(v + 0.5L));
	else v = ceill(x87(v - 0.5L));
	v = x87(v / f);
	return (double) v;
	}
}

/*
 * Locales. musl "succeeds" for any locale name while only ever behaving like
 * C/UTF-8. Model a Linux server with no extra locales installed instead:
 * "C" and "POSIX" work (reported as "C", as glibc does); anything else fails,
 * so setlocale() returns FALSE to scripts exactly as it would there.
 */
#include <locale.h>

static const char *locale_env(int cat)
{
	static const char *names[] = { "LC_CTYPE", "LC_NUMERIC", "LC_TIME", "LC_COLLATE", "LC_MONETARY", "LC_MESSAGES" };
	const char *v = getenv("LC_ALL");

	if ((!v || !*v) && cat >= 0 && cat < (int) (sizeof(names) / sizeof(names[0]))) v = getenv(names[cat]);
	if (!v || !*v) v = getenv("LANG");
	return (v && *v) ? v : "C";
}

char *setlocale(int category, const char *name)
{
	static char c_locale[] = "C";

	if (category < 0 || category > LC_ALL) return NULL;
	if (!name) return c_locale;
	if (!*name) name = locale_env(category == LC_ALL ? 0 : category);
	if (!strcmp(name, "C") || !strcmp(name, "POSIX")) return c_locale;
	return NULL;
}

/*
 * NaN signs. x86 FPUs return a negative "default NaN" for invalid operations
 * and propagate NaN operands unchanged; which NaN wasm produces depends on the
 * host CPU. r is the computed result, a/b the operands, newsign the sign the
 * i386 build produces for a freshly generated NaN (glibc's libm varies).
 * Only bitwise operations are used to build the result, so it is exact.
 */
double simphp_nan_fix(double r, double a, double b, int newsign)
{
	if (r == r) return r;
	if (a != a) return a;
	if (b != b) return b;
	return newsign < 0 ? -__builtin_nan("") : __builtin_nan("");
}

/*
 * DNS. The simulated server has no network: resolver lookups fail the way
 * they do on an offline Linux box (HOST_NOT_FOUND), so checkdnsrr()/getmxrr()
 * exist and return FALSE rather than being missing.
 */
#include <netdb.h>

int res_search(const char *dname, int class, int type, unsigned char *answer, int anslen)
{
	(void) dname; (void) class; (void) type; (void) answer; (void) anslen;
	h_errno = HOST_NOT_FOUND;
	return -1;
}

/*
 * Processes. wasm cannot fork, but PHP only ever starts programs through
 * popen() (exec, system, passthru, shell_exec, `backticks`, popen(), mail()).
 * Commands are handed to a small /bin/sh emulation (simphp_shell.js) that runs
 * against the same filesystem; the pipe itself is a temporary file.
 *   "r": the command runs immediately, its stdout is read back by PHP.
 *   "w": PHP writes the command's stdin; it runs at pclose() (e.g. sendmail).
 * pclose() returns a wait(2)-style status, as glibc does.
 */
#include <stdio.h>

extern int simphp_shell(const char *cmd, const char *input, int input_len, char **out, int *out_len);

typedef struct simphp_pipe {
	FILE *fp;
	char *cmd;
	int writing;
	int status;
	struct simphp_pipe *next;
} simphp_pipe;

static simphp_pipe *simphp_pipes;

FILE *popen(const char *cmd, const char *mode)
{
	simphp_pipe *p;
	FILE *fp;

	if (!cmd || !mode || (mode[0] != 'r' && mode[0] != 'w')) {
		errno = EINVAL;
		return NULL;
	}
	fp = tmpfile();
	if (!fp) return NULL;
	p = calloc(1, sizeof(*p));
	p->fp = fp;
	p->cmd = strdup(cmd);
	p->writing = (mode[0] == 'w');
	if (!p->writing) {
		char *out = NULL;
		int len = 0;

		fflush(stdout);
		p->status = simphp_shell(cmd, NULL, 0, &out, &len);
		if (len > 0) fwrite(out, 1, len, fp);
		free(out);
		rewind(fp);
	}
	p->next = simphp_pipes;
	simphp_pipes = p;
	return fp;
}

int pclose(FILE *fp)
{
	simphp_pipe **pp, *p;
	int status;

	for (pp = &simphp_pipes; *pp && (*pp)->fp != fp; pp = &(*pp)->next);
	if (!*pp) {
		errno = ECHILD;
		return -1;
	}
	p = *pp;
	*pp = p->next;
	status = p->status;
	if (p->writing) {
		long size;
		char *in, *out = NULL;
		int len = 0;

		fflush(fp);
		size = ftell(fp);
		in = malloc(size > 0 ? size : 1);
		rewind(fp);
		size = (long) fread(in, 1, size, fp);
		fflush(stdout);
		status = simphp_shell(p->cmd, in, (int) size, &out, &len);
		if (len > 0) fwrite(out, 1, len, stdout);   /* child inherits our stdout */
		free(in);
		free(out);
	}
	fclose(fp);
	free(p->cmd);
	free(p);
	return (status & 0xff) << 8;
}

/*
 * Users and groups, read from /etc/passwd and /etc/group like glibc's "files"
 * NSS backend (PHP's main/php.h maps getpwuid() etc. to these).
 */
#include <pwd.h>
#include <grp.h>

static char *simphp_field(char **p)
{
	char *start = *p, *c = strchr(start, ':');

	if (c) { *c = '\0'; *p = c + 1; } else { *p = start + strlen(start); }
	return start;
}

static struct passwd *simphp_pwscan(int by_uid, uid_t uid, const char *name)
{
	static struct passwd pw;
	static char line[512];
	FILE *f = fopen("/etc/passwd", "r");

	if (!f) return NULL;
	while (fgets(line, sizeof(line), f)) {
		char *p = line, *nl = strchr(line, '\n');

		if (nl) *nl = '\0';
		pw.pw_name = simphp_field(&p);
		pw.pw_passwd = simphp_field(&p);
		pw.pw_uid = (uid_t) atoi(simphp_field(&p));
		pw.pw_gid = (gid_t) atoi(simphp_field(&p));
		pw.pw_gecos = simphp_field(&p);
		pw.pw_dir = simphp_field(&p);
		pw.pw_shell = simphp_field(&p);
		if (by_uid ? pw.pw_uid == uid : !strcmp(pw.pw_name, name)) {
			fclose(f);
			return &pw;
		}
	}
	fclose(f);
	return NULL;
}

struct passwd *simphp_getpwuid(uid_t uid) { return simphp_pwscan(1, uid, NULL); }
struct passwd *simphp_getpwnam(const char *name) { return name ? simphp_pwscan(0, 0, name) : NULL; }

static struct group *simphp_grscan(int by_gid, gid_t gid, const char *name)
{
	static struct group gr;
	static char line[512];
	static char *members[32];
	FILE *f = fopen("/etc/group", "r");

	if (!f) return NULL;
	while (fgets(line, sizeof(line), f)) {
		char *p = line, *nl = strchr(line, '\n'), *m;
		int n = 0;

		if (nl) *nl = '\0';
		gr.gr_name = simphp_field(&p);
		gr.gr_passwd = simphp_field(&p);
		gr.gr_gid = (gid_t) atoi(simphp_field(&p));
		for (m = strtok(p, ","); m && n < 31; m = strtok(NULL, ",")) members[n++] = m;
		members[n] = NULL;
		gr.gr_mem = members;
		if (by_gid ? gr.gr_gid == gid : !strcmp(gr.gr_name, name)) {
			fclose(f);
			return &gr;
		}
	}
	fclose(f);
	return NULL;
}

struct group *simphp_getgrgid(gid_t gid) { return simphp_grscan(1, gid, NULL); }
struct group *simphp_getgrnam(const char *name) { return name ? simphp_grscan(0, 0, name) : NULL; }

/* Each request is a new Apache/CGI child: give it a plausible PID instead of
 * emscripten's constant 42. */
extern double emscripten_date_now(void);

pid_t __syscall_getpid(void)
{
	static pid_t pid;

	if (!pid) pid = 1024 + (pid_t) ((unsigned long long) (emscripten_date_now() * 1000.0) % 30000);
	return pid;
}

/*
 * errno values as Linux i386 numbers them, for the places where PHP shows them
 * (see simphp_errno.h), and glibc's strerror() texts.
 */
#include "simphp_errno_table.c"

int simphp_linux_errno(int e)
{
	if (e > 0 && e < (int) sizeof(simphp_wasm_to_linux) && simphp_wasm_to_linux[e]) return simphp_wasm_to_linux[e];
	return e;
}

char *simphp_strerror(int e)
{
	static char buf[40];
	int l = simphp_linux_errno(e);

	if (l >= 0 && l < (int) (sizeof(simphp_glibc_errmsg) / sizeof(simphp_glibc_errmsg[0])))
		return (char *) simphp_glibc_errmsg[l];
	sprintf(buf, "Unknown error %d", l);
	return buf;
}

/*
 * Network: an offline Linux box whose only interface is loopback, with no
 * DNS server reachable. Sockets can be created; connecting to a local UNIX
 * socket path that doesn't exist gives ENOENT, anything on 127.0.0.0/8 is
 * refused (nothing listens), everything else is unreachable. Names resolve
 * from /etc/hosts only. This is what makes mysql_connect() print the classic
 * "Can't connect to local MySQL server through socket '/tmp/mysql.sock' (2)".
 */
#include <sys/socket.h>
#include <sys/un.h>
#include <sys/stat.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <fcntl.h>
#include <unistd.h>
#include <strings.h>

#define SIMPHP_MAXFD 1024
static unsigned char simphp_sockfd[SIMPHP_MAXFD];

static int simphp_is_sock(int fd) { return fd >= 0 && fd < SIMPHP_MAXFD && simphp_sockfd[fd]; }

int socket(int domain, int type, int protocol)
{
	int fd;

	(void) protocol;
	if (domain != AF_UNIX && domain != AF_INET && domain != AF_INET6) {
		errno = EAFNOSUPPORT;
		return -1;
	}
	fd = open("/dev/null", O_RDWR);
	if (fd >= 0 && fd < SIMPHP_MAXFD) simphp_sockfd[fd] = 1 + (type & 0xf);
	return fd;
}

/* Local services implemented in JS (simphp_lib.js / mysqld.js): returns
 * nonzero when something is listening and the connection was accepted. */
extern int simphp_service_connect(int fd, const char *unix_path, int port);
#define SIMPHP_SOCK_SERVICE 0x40

int connect(int fd, const struct sockaddr *addr, socklen_t len)
{
	(void) len;
	if (!simphp_is_sock(fd)) { errno = ENOTSOCK; return -1; }
	if (addr->sa_family == AF_UNIX) {
		struct stat st;
		const struct sockaddr_un *un = (const struct sockaddr_un *) addr;

		if (simphp_service_connect(fd, un->sun_path, 0)) { simphp_sockfd[fd] |= SIMPHP_SOCK_SERVICE; return 0; }
		errno = stat(un->sun_path, &st) ? ENOENT : ECONNREFUSED;
		return -1;
	}
	if (addr->sa_family == AF_INET) {
		const struct sockaddr_in *in = (const struct sockaddr_in *) addr;
		uint32_t ip = ntohl(in->sin_addr.s_addr);

		if (((ip >> 24) == 127 || ip == 0) && simphp_service_connect(fd, NULL, ntohs(in->sin_port))) {
			simphp_sockfd[fd] |= SIMPHP_SOCK_SERVICE;
			return 0;
		}
		errno = ((ip >> 24) == 127 || ip == 0) ? ECONNREFUSED : ENETUNREACH;
		return -1;
	}
	if (addr->sa_family == AF_INET6) {
		const struct sockaddr_in6 *in6 = (const struct sockaddr_in6 *) addr;

		errno = IN6_IS_ADDR_LOOPBACK(&in6->sin6_addr) ? ECONNREFUSED : ENETUNREACH;
		return -1;
	}
	errno = EAFNOSUPPORT;
	return -1;
}

int setsockopt(int fd, int level, int name, const void *val, socklen_t len)
{
	(void) level; (void) name; (void) val; (void) len;
	if (!simphp_is_sock(fd)) { errno = ENOTSOCK; return -1; }
	return 0;
}

int getsockopt(int fd, int level, int name, void *val, socklen_t *len)
{
	(void) level; (void) name;
	if (!simphp_is_sock(fd)) { errno = ENOTSOCK; return -1; }
	if (val && len && *len >= sizeof(int)) { *(int *) val = 0; *len = sizeof(int); }
	return 0;
}

static int simphp_resolve(const char *name, struct in_addr *out, const char **canon)
{
	if (!name) return 0;
	if (inet_aton(name, out)) { *canon = name; return 1; }
	if (!strcasecmp(name, "localhost") || !strcasecmp(name, "localhost.localdomain") || !strcasecmp(name, "simphp")) {
		out->s_addr = htonl(0x7f000001);
		*canon = "simphp";        /* first name on the /etc/hosts line */
		return 1;
	}
	return 0;
}

struct hostent *gethostbyname(const char *name)
{
	static struct hostent he;
	static struct in_addr addr;
	static char *addrs[2], *aliases[1], cname[256];
	const char *canon;

	if (!simphp_resolve(name, &addr, &canon)) {
		h_errno = TRY_AGAIN;   /* no DNS server answers */
		errno = EAGAIN;        /* left behind by the resolver's failed send */
		return NULL;
	}
	strncpy(cname, canon, sizeof(cname) - 1);
	addrs[0] = (char *) &addr; addrs[1] = NULL;
	aliases[0] = NULL;
	he.h_name = cname;
	he.h_aliases = aliases;
	he.h_addrtype = AF_INET;
	he.h_length = 4;
	he.h_addr_list = addrs;
	return &he;
}

int gethostbyname_r(const char *name, struct hostent *ret, char *buf, size_t buflen,
                    struct hostent **result, int *h_errnop)
{
	struct hostent *he = gethostbyname(name);

	*result = NULL;
	if (!he) { if (h_errnop) *h_errnop = h_errno; return TRY_AGAIN; }
	if (buflen < 4 + 3 * sizeof(char *) + strlen(he->h_name) + 1) return ERANGE;
	{
		char **ptrs = (char **) buf;
		char *addr = buf + 3 * sizeof(char *);
		char *nm = addr + 4;

		memcpy(addr, he->h_addr_list[0], 4);
		strcpy(nm, he->h_name);
		ptrs[0] = addr; ptrs[1] = NULL; ptrs[2] = NULL;
		ret->h_name = nm;
		ret->h_aliases = &ptrs[2];
		ret->h_addrtype = AF_INET;
		ret->h_length = 4;
		ret->h_addr_list = ptrs;
	}
	*result = ret;
	return 0;
}

struct hostent *gethostbyaddr(const void *a, socklen_t len, int type)
{
	static struct hostent he;
	static struct in_addr addr;
	static char *addrs[2], *aliases[3], name[] = "simphp", al1[] = "localhost.localdomain", al2[] = "localhost";

	if (type != AF_INET || len != 4 || (ntohl(((const struct in_addr *) a)->s_addr) >> 24) != 127) {
		h_errno = TRY_AGAIN;
		return NULL;
	}
	memcpy(&addr, a, 4);
	addrs[0] = (char *) &addr; addrs[1] = NULL;
	aliases[0] = al1; aliases[1] = al2; aliases[2] = NULL;
	he.h_name = name; he.h_aliases = aliases; he.h_addrtype = AF_INET; he.h_length = 4; he.h_addr_list = addrs;
	return &he;
}

int getaddrinfo(const char *node, const char *service, const struct addrinfo *hints, struct addrinfo **res)
{
	struct in_addr addr;
	const char *canon;
	struct addrinfo *ai;
	struct sockaddr_in *sin;
	int port = 0;

	if (hints && hints->ai_family != AF_UNSPEC && hints->ai_family != AF_INET) return EAI_FAMILY;
	if (service) {
		char *end;
		port = (int) strtol(service, &end, 10);
		if (*end) return EAI_SERVICE;
	}
	if (!node) addr.s_addr = htonl((hints && (hints->ai_flags & AI_PASSIVE)) ? INADDR_ANY : INADDR_LOOPBACK), canon = "simphp";
	else if (!simphp_resolve(node, &addr, &canon)) {
		errno = EAGAIN;
		return (hints && (hints->ai_flags & AI_NUMERICHOST)) ? EAI_NONAME : EAI_AGAIN;
	}
	ai = calloc(1, sizeof(*ai) + sizeof(*sin));
	sin = (struct sockaddr_in *) (ai + 1);
	sin->sin_family = AF_INET;
	sin->sin_port = htons(port);
	sin->sin_addr = addr;
	ai->ai_family = AF_INET;
	ai->ai_socktype = hints && hints->ai_socktype ? hints->ai_socktype : SOCK_STREAM;
	ai->ai_protocol = hints ? hints->ai_protocol : 0;
	ai->ai_addrlen = sizeof(*sin);
	ai->ai_addr = (struct sockaddr *) sin;
	*res = ai;
	return 0;
}

void freeaddrinfo(struct addrinfo *ai)
{
	while (ai) {
		struct addrinfo *next = ai->ai_next;
		free(ai);
		ai = next;
	}
}

const char *gai_strerror(int code)
{
	switch (code) {
		case EAI_AGAIN: return "Temporary failure in name resolution";
		case EAI_BADFLAGS: return "Bad value for ai_flags";
		case EAI_FAIL: return "Non-recoverable failure in name resolution";
		case EAI_FAMILY: return "ai_family not supported";
		case EAI_MEMORY: return "Memory allocation failure";
		case EAI_NONAME: return "Name or service not known";
		case EAI_SERVICE: return "Servname not supported for ai_socktype";
		case EAI_SOCKTYPE: return "ai_socktype not supported";
		case EAI_SYSTEM: return "System error";
		default: return "Unknown error";
	}
}

/*
 * atoi()/atol(): glibc implements them as strtol(), which saturates at
 * LONG_MAX/LONG_MIN; musl's wrap around. PHP uses them all over (e.g.
 * unserialize('i:99999999999;') is int(2147483647) on Linux).
 */
int atoi(const char *s) { return (int) strtol(s, NULL, 10); }
long atol(const char *s) { return strtol(s, NULL, 10); }

/*
 * pow(): PHP 4.1.1 computes exp(log(x) * y). On i386, log() leaves an 80-bit
 * result on the x87 stack, the multiply happens at that precision, and only
 * the argument handed to exp() is rounded to double. (pow(10, -15) prints
 * 1E-15 there, 9.9999999999999E-16 in plain double arithmetic.)
 */
/* musl's logl/expl for 128-bit long double just call the double versions,
 * so compute ln and exp here with series in quad precision (113 bits), then
 * round to the x87 width like the FPU's fyl2x/f2xm1 results. */
static const long double LN2_Q = 0.693147180559945309417232121458176568075500134360255254120680009493393621969694715605863326996418687542001481021L;

static long double q_log(long double x)
{
	int e, k;
	long double m, s, s2, term, sum = 0;

	if (x != x || x < 0) return __builtin_nanl("");
	if (x == 0) return -__builtin_infl();
	if (isinf(x)) return x;
	m = frexpl(x, &e);                         /* 0.5 <= m < 1 */
	if (m < 0.70710678118654752440084436210484903928L) { m *= 2; e--; }
	s = (m - 1) / (m + 1);                     /* |s| <= 0.1716 */
	s2 = s * s;
	term = s;
	for (k = 1; k < 400; k += 2) {
		long double add = term / k;
		sum += add;
		if (fabsl(add) <= fabsl(sum) * 1e-36L) break;
		term *= s2;
	}
	return 2 * sum + (long double) e * LN2_Q;
}

static long double q_exp(long double t)
{
	long double kf, r, sum = 1, term = 1;
	int n;

	if (t != t) return t;
	if (t > 11357) return __builtin_infl();
	if (t < -11500) return 0;
	kf = rintl(t / LN2_Q);
	r = t - kf * LN2_Q;                        /* |r| <= 0.35 */
	for (n = 1; n < 80; n++) {
		term *= r / n;
		sum += term;
		if (fabsl(term) <= 1e-36L) break;
	}
	return ldexpl(sum, (int) kf);
}

double simphp_x87_explog(double x, double y)
{
	long double l, t;

	if (x != x || y != y) return x + y;
	l = x87(q_log((long double) x));           /* log() result stays on the FPU stack */
	t = (double) x87(l * (long double) y);     /* the argument to exp() is a double */
	return (double) q_exp(t);                  /* glibc exp(): correctly rounded double */
}

/* One x87 operation, then the store to a double (two roundings). Quad holds
 * the exact product of two doubles and (for exponents within 60 bits) the
 * exact sum, so the 64-bit rounding is the FPU's. */
double simphp_x87_add(double a, double b) { return (double) x87((long double) a + (long double) b); }
double simphp_x87_sub(double a, double b) { return (double) x87((long double) a - (long double) b); }
double simphp_x87_mul(double a, double b) { return (double) x87((long double) a * (long double) b); }
double simphp_x87_div(double a, double b)
{
	if (b == 0) return a / b;
	return (double) x87((long double) a / (long double) b);
}
/* (a / b) * c as one x87 expression: the quotient is not stored in between */
double simphp_x87_divmul(double a, double b, double c)
{
	return (double) x87(x87((long double) a / (long double) b) * (long double) c);
}

/*
 * strftime() with glibc's behavior in the C locale: GNU flags (_ - 0 ^ #),
 * field widths, E/O modifiers, %k %l %P %s %G %g %V ..., and unknown
 * conversions copied through literally (musl rejects the whole format).
 */
static const char *const simphp_wday_full[] = { "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday" };
static const char *const simphp_mon_full[] = { "January", "February", "March", "April", "May", "June", "July",
	"August", "September", "October", "November", "December" };

static int simphp_iso_week(const struct tm *tm, int *iso_year)
{
	/* ISO 8601 week number and year */
	int year = tm->tm_year + 1900, yday = tm->tm_yday, wday = (tm->tm_wday + 6) % 7; /* Mon=0 */
	int week = (yday - wday + 10) / 7;

	if (week < 1) {
		int py = year - 1, pleap = (py % 4 == 0 && py % 100 != 0) || py % 400 == 0;
		int pyday = yday + 365 + pleap;
		week = (pyday - wday + 10) / 7;
		year = py;
	} else {
		int leap = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
		if (yday - wday + 3 >= 365 + leap) { week = 1; year++; }
	}
	if (iso_year) *iso_year = year;
	return week;
}

size_t simphp_strftime(char *restrict s, size_t max, const char *restrict fmt, const struct tm *restrict tm)
{
	size_t n = 0;
	char buf[64];

#define PUT(c) do { if (n + 1 >= max) return 0; s[n++] = (c); } while (0)
	for (; *fmt; fmt++) {
		const char *start = fmt, *str = NULL;
		int pad = 0, upper = 0, swapcase = 0, width = -1, num = 0, digits = 2, numeric = 0, defpad = '0';
		long long val = 0;

		if (*fmt != '%') { PUT(*fmt); continue; }
		for (fmt++; *fmt == '_' || *fmt == '-' || *fmt == '0' || *fmt == '^' || *fmt == '#'; fmt++) {
			if (*fmt == '^') upper = 1; else if (*fmt == '#') swapcase = 1; else pad = *fmt;
		}
		if (*fmt >= '1' && *fmt <= '9') { width = 0; while (*fmt >= '0' && *fmt <= '9') width = width * 10 + (*fmt++ - '0'); }
		if (*fmt == 'E' || *fmt == 'O') fmt++;
		switch (*fmt) {
			case 'a': str = simphp_wday_full[tm->tm_wday % 7]; num = 3; break;
			case 'A': str = simphp_wday_full[tm->tm_wday % 7]; break;
			case 'b': case 'h': str = simphp_mon_full[tm->tm_mon % 12]; num = 3; break;
			case 'B': str = simphp_mon_full[tm->tm_mon % 12]; break;
			case 'c': simphp_strftime(buf, sizeof buf, "%a %b %e %H:%M:%S %Y", tm); str = buf; break;
			case 'C': numeric = 1; val = (tm->tm_year + 1900) / 100; break;
			case 'd': numeric = 1; val = tm->tm_mday; break;
			case 'D': case 'x': simphp_strftime(buf, sizeof buf, "%m/%d/%y", tm); str = buf; break;
			case 'e': numeric = 1; val = tm->tm_mday; defpad = '_'; break;
			case 'F': simphp_strftime(buf, sizeof buf, "%Y-%m-%d", tm); str = buf; break;
			case 'G': { int y; simphp_iso_week(tm, &y); numeric = 1; val = y; digits = 1; break; }
			case 'g': { int y; simphp_iso_week(tm, &y); numeric = 1; val = ((y % 100) + 100) % 100; break; }
			case 'H': numeric = 1; val = tm->tm_hour; break;
			case 'I': numeric = 1; val = tm->tm_hour % 12 ? tm->tm_hour % 12 : 12; break;
			case 'j': numeric = 1; val = tm->tm_yday + 1; digits = 3; break;
			case 'k': numeric = 1; val = tm->tm_hour; defpad = '_'; break;
			case 'l': numeric = 1; val = tm->tm_hour % 12 ? tm->tm_hour % 12 : 12; defpad = '_'; break;
			case 'm': numeric = 1; val = tm->tm_mon + 1; break;
			case 'M': numeric = 1; val = tm->tm_min; break;
			case 'n': str = "\n"; break;
			case 'p': str = tm->tm_hour < 12 ? "AM" : "PM"; if (swapcase) { str = tm->tm_hour < 12 ? "am" : "pm"; swapcase = 0; } break;
			case 'P': str = tm->tm_hour < 12 ? "am" : "pm"; break;
			case 'r': simphp_strftime(buf, sizeof buf, "%I:%M:%S %p", tm); str = buf; break;
			case 'R': simphp_strftime(buf, sizeof buf, "%H:%M", tm); str = buf; break;
			case 's': { struct tm t = *tm; numeric = 1; val = (long long) mktime(&t); digits = 1; break; }
			case 'S': numeric = 1; val = tm->tm_sec; break;
			case 't': str = "\t"; break;
			case 'T': case 'X': simphp_strftime(buf, sizeof buf, "%H:%M:%S", tm); str = buf; break;
			case 'u': numeric = 1; val = tm->tm_wday ? tm->tm_wday : 7; digits = 1; break;
			case 'U': numeric = 1; val = (tm->tm_yday - tm->tm_wday + 7) / 7; break;
			case 'V': numeric = 1; val = simphp_iso_week(tm, NULL); break;
			case 'w': numeric = 1; val = tm->tm_wday; digits = 1; break;
			case 'W': numeric = 1; val = (tm->tm_yday - (tm->tm_wday - 1 + 7) % 7 + 7) / 7; break;
			case 'y': numeric = 1; val = ((tm->tm_year % 100) + 100) % 100; break;
			case 'Y': numeric = 1; val = tm->tm_year + 1900; digits = 1; break;
			case 'z': {
				long off = tm->__tm_gmtoff;
				char sign = off < 0 ? '-' : '+';
				if (off < 0) off = -off;
				snprintf(buf, sizeof buf, "%c%02ld%02ld", sign, off / 3600, (off / 60) % 60);
				str = buf;
				break;
			}
			case 'Z': str = tm->__tm_zone ? tm->__tm_zone : ""; if (swapcase) { upper = 0; } break;
			case '%': str = "%"; break;
			default:
				/* unknown (or a lone trailing %): copied through unchanged */
				if (!*fmt) fmt--;
				for (; start <= fmt; start++) PUT(*start);
				continue;
		}
		if (numeric) {
			int len, p = pad ? pad : defpad, w = width >= 0 ? width : digits;
			char tmp[32];
			if (pad == '-') { len = snprintf(tmp, sizeof tmp, "%lld", val); }
			else if (p == '_') { len = snprintf(tmp, sizeof tmp, "%*lld", w, val); }
			else { len = snprintf(tmp, sizeof tmp, "%0*lld", w, val); }
			for (int i = 0; i < len; i++) PUT(tmp[i]);
		} else {
			int len = num ? num : (int) strlen(str);
			int w = width > len ? width - len : 0;
			if (pad != '-') while (w-- > 0) PUT(pad == '0' ? '0' : ' ');
			for (int i = 0; i < len; i++) {
				char c = str[i];
				if (upper || (swapcase && *fmt != 'Z')) c = (c >= 'a' && c <= 'z') ? c - 32 : c;
				else if (swapcase && *fmt == 'Z') c = (c >= 'A' && c <= 'Z') ? c + 32 : c;
				PUT(c);
			}
		}
	}
#undef PUT
	if (n >= max) return 0;
	s[n] = '\0';
	return n;
}

/*
 * ctype_*(): PHP 4.1.1 passes integers straight to isdigit() & co. glibc
 * indexes its class table without a range check, so ctype_digit(1000) reads
 * whatever follows the table (and answers accordingly). Use glibc's actual
 * table bytes, captured from an i386 box, for both integers and string bytes.
 */
#include <ctype.h>
#include "simphp_ctype_table.c"

int simphp_glibc_ctype(int (*iswhat)(int), long c)
{
	unsigned short mask;

	if (iswhat == isupper) mask = 0x100;
	else if (iswhat == islower) mask = 0x200;
	else if (iswhat == isalpha) mask = 0x400;
	else if (iswhat == isdigit) mask = 0x800;
	else if (iswhat == isxdigit) mask = 0x1000;
	else if (iswhat == isspace) mask = 0x2000;
	else if (iswhat == isprint) mask = 0x4000;
	else if (iswhat == isgraph) mask = 0x8000;
	else if (iswhat == iscntrl) mask = 0x2;
	else if (iswhat == ispunct) mask = 0x4;
	else if (iswhat == isalnum) mask = 0x8;
	else return iswhat((int) c);
	if (c < -128 || c >= 2200) return 0;
	return simphp_glibc_ctype_b[c + 128] & mask;
}

/* I/O on sockets connected to a simulated local service; anything else is a
 * plain file descriptor. */
extern int simphp_service_read(int fd, void *buf, int size);
extern int simphp_service_write(int fd, const void *buf, int size);
extern void simphp_service_close(int fd);

int simphp_sock_read(int fd, void *buf, int size)
{
	if (fd >= 0 && fd < SIMPHP_MAXFD && (simphp_sockfd[fd] & SIMPHP_SOCK_SERVICE))
		return simphp_service_read(fd, buf, size);
	return (int) read(fd, buf, size);
}

int simphp_sock_write(int fd, const void *buf, int size)
{
	if (fd >= 0 && fd < SIMPHP_MAXFD && (simphp_sockfd[fd] & SIMPHP_SOCK_SERVICE)) {
		int r = simphp_service_write(fd, buf, size);
		if (r < 0) errno = EPIPE;	/* the service closed the connection */
		return r;
	}
	return (int) write(fd, buf, size);
}

int simphp_sock_close(int fd)
{
	if (fd >= 0 && fd < SIMPHP_MAXFD) {
		if (simphp_sockfd[fd] & SIMPHP_SOCK_SERVICE) simphp_service_close(fd);
		simphp_sockfd[fd] = 0;
	}
	return close(fd);
}

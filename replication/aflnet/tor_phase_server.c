/* Plain-TCP phase-routing server for AFLNet (-P TOR).
 * Reads a sequence of length-prefixed messages (2-byte big-endian len + payload)
 * and routes each to the real Tor parser for its phase, replying 1 status byte
 * per message so AFLNet's state model separates the three phases:
 *   phase 0 -> OR-link handshake (netinfo_cell_parse)
 *   phase 1 -> circuit creation  (create_cell_parse / created_cell_parse)
 *   phase 2+-> extension         (extend_cell_parse / extended_cell_parse)  */
#include "orconfig.h"
#include "core/or/or.h"
#include "core/or/onion.h"
#include "core/or/cell_st.h"
#include "core/or/relay.h"
#include "trunnel/netinfo.h"
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <unistd.h>
#include <arpa/inet.h>
#include <sys/socket.h>
#include <netinet/in.h>

static int readn(int fd, void *b, size_t n) {
  size_t g = 0;
  while (g < n) {
    ssize_t r = read(fd, (char *)b + g, n - g);
    if (r <= 0) return (int)g;
    g += (size_t)r;
  }
  return (int)g;
}

static void route(int phase, const unsigned char *payload, size_t len) {
  if (phase == 0) {
    netinfo_cell_t *ni = NULL;
    netinfo_cell_parse(&ni, payload, len);
    if (ni) netinfo_cell_free(ni);
  } else if (phase == 1) {
    cell_t cell;
    memset(&cell, 0, sizeof(cell));
    cell.command = CELL_CREATE2;
    size_t pl = len > CELL_PAYLOAD_SIZE ? CELL_PAYLOAD_SIZE : len;
    memcpy(cell.payload, payload, pl);
    create_cell_t cc; memset(&cc, 0, sizeof(cc)); create_cell_parse(&cc, &cell);
    created_cell_t crc; memset(&crc, 0, sizeof(crc)); created_cell_parse(&crc, &cell);
  } else {
    extend_cell_t ec; memset(&ec, 0, sizeof(ec));
    extend_cell_parse(&ec, RELAY_COMMAND_EXTEND2, payload, len);
    extended_cell_t exc; memset(&exc, 0, sizeof(exc));
    extended_cell_parse(&exc, RELAY_COMMAND_EXTENDED2, payload, len);
  }
}

int main(int argc, char **argv) {
  int port = argc > 1 ? atoi(argv[1]) : 9999;
  int s = socket(AF_INET, SOCK_STREAM, 0);
  int one = 1;
  setsockopt(s, SOL_SOCKET, SO_REUSEADDR, &one, sizeof(one));
  struct sockaddr_in a;
  memset(&a, 0, sizeof(a));
  a.sin_family = AF_INET;
  a.sin_port = htons(port);
  a.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
  if (bind(s, (struct sockaddr *)&a, sizeof(a)) < 0) { perror("bind"); return 1; }
  listen(s, 1);
  for (;;) {
    int cfd = accept(s, NULL, NULL);
    if (cfd < 0) continue;
    int phase = 0;
    unsigned char lb[2];
    while (readn(cfd, lb, 2) == 2) {
      unsigned int L = ((unsigned int)lb[0] << 8) | (unsigned int)lb[1];
      if (L > 4096) L = 4096;
      unsigned char *p = (unsigned char *)malloc(L ? L : 1);
      int got = readn(cfd, p, L);
      route(phase, p, (size_t)got);
      free(p);
      unsigned char code = (unsigned char)(phase < 2 ? phase : 2);
      if (write(cfd, &code, 1) < 0) { /* ignore */ }
      phase++;
    }
    close(cfd);
    break; /* one session per fork; AFLNet restarts */
  }
  close(s);
  return 0;
}

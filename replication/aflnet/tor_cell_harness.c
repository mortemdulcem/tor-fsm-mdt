/* Coverage-guided fuzz harness for Tor circuit-establishment cell parsers.
 * Feeds the input bytes to create/created/extend/extended cell parsers,
 * i.e. exactly the CREATE/CREATED/EXTEND/EXTENDED cells the FSM models.
 * Byte 0 -> cell command; remaining bytes -> cell payload. */
#include "orconfig.h"
#include "core/or/or.h"
#include "core/or/onion.h"
#include "core/or/cell_st.h"
#include "core/or/relay.h"
#include <stdio.h>
#include <string.h>

int
main(int argc, char **argv)
{
  if (argc < 2)
    return 0;
  FILE *f = fopen(argv[1], "rb");
  if (!f)
    return 0;
  unsigned char buf[4096];
  size_t n = fread(buf, 1, sizeof(buf), f);
  fclose(f);
  if (n == 0)
    return 0;

  cell_t cell;
  memset(&cell, 0, sizeof(cell));
  cell.command = buf[0];
  size_t pl = (n > 1) ? (n - 1) : 0;
  if (pl > CELL_PAYLOAD_SIZE)
    pl = CELL_PAYLOAD_SIZE;
  memcpy(cell.payload, buf + 1, pl);

  create_cell_t cc;
  memset(&cc, 0, sizeof(cc));
  create_cell_parse(&cc, &cell);

  created_cell_t crc;
  memset(&crc, 0, sizeof(crc));
  created_cell_parse(&crc, &cell);

  extend_cell_t ec;
  memset(&ec, 0, sizeof(ec));
  extend_cell_parse(&ec, RELAY_COMMAND_EXTEND2, cell.payload, pl);

  extended_cell_t exc;
  memset(&exc, 0, sizeof(exc));
  extended_cell_parse(&exc, RELAY_COMMAND_EXTENDED2, cell.payload, pl);

  return 0;
}

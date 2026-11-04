import os
base=os.path.expanduser('~/aflnet')

TOR_FUNCS=r'''

/* ---- Tor OR-protocol module: phase-separated message regions ----
 * Framing: each message = 2-byte big-endian length prefix + payload.
 * Phase 0 = OR-link handshake, 1 = circuit creation, 2 = extension. */
region_t* extract_requests_tor(unsigned char* buf, unsigned int buf_size, unsigned int* region_count_ref)
{
  unsigned int region_count = 0;
  region_t *regions = NULL;
  unsigned int cur = 0;
  while (cur + 2 <= buf_size) {
    unsigned int L = ((unsigned int)buf[cur] << 8) | (unsigned int)buf[cur+1];
    unsigned int end = cur + 2 + L;            /* one past last byte */
    if (end > buf_size) end = buf_size;        /* truncated: take the rest */
    region_count++;
    regions = (region_t *)ck_realloc(regions, region_count * sizeof(region_t));
    regions[region_count-1].start_byte = cur;
    regions[region_count-1].end_byte = end - 1;
    regions[region_count-1].state_sequence = NULL;
    regions[region_count-1].state_count = 0;
    if (end >= buf_size) break;
    cur = end;
  }
  if ((region_count == 0) && (buf_size > 0)) {
    regions = (region_t *)ck_realloc(regions, sizeof(region_t));
    regions[0].start_byte = 0;
    regions[0].end_byte = buf_size - 1;
    regions[0].state_sequence = NULL;
    regions[0].state_count = 0;
    region_count = 1;
  }
  *region_count_ref = region_count;
  return regions;
}

unsigned int* extract_response_codes_tor(unsigned char* buf, unsigned int buf_size, unsigned int* state_count_ref)
{
  unsigned int *state_sequence = NULL;
  unsigned int state_count = 0;
  state_count++;
  state_sequence = (unsigned int *)ck_realloc(state_sequence, state_count * sizeof(unsigned int));
  state_sequence[0] = 0;                        /* initial state */
  for (unsigned int i = 0; i < buf_size; i++) { /* one reply byte per phase */
    state_count++;
    state_sequence = (unsigned int *)ck_realloc(state_sequence, state_count * sizeof(unsigned int));
    state_sequence[state_count-1] = (unsigned int)buf[i] + 1u;  /* 1,2,3 for phases 0,1,2 */
  }
  *state_count_ref = state_count;
  return state_sequence;
}
'''

# aflnet.h: prototypes before last #endif
h=open(base+'/aflnet.h').read()
if 'extract_requests_tor' not in h:
    proto=('\nregion_t* extract_requests_tor(unsigned char* buf, unsigned int buf_size, unsigned int* region_count_ref);\n'
           'unsigned int* extract_response_codes_tor(unsigned char* buf, unsigned int buf_size, unsigned int* state_count_ref);\n')
    idx=h.rfind('#endif')
    h=h[:idx]+proto+'\n'+h[idx:]
    open(base+'/aflnet.h','w').write(h)
    print('aflnet.h patched')

# aflnet.c: append function defs
c=open(base+'/aflnet.c').read()
if 'extract_requests_tor' not in c:
    open(base+'/aflnet.c','w').write(c+TOR_FUNCS)
    print('aflnet.c patched')

# afl-fuzz.c: add TOR branch before RTSP
f=open(base+'/afl-fuzz.c').read()
if 'extract_requests_tor' not in f:
    anchor='if (!strcmp(optarg, "RTSP")) {'
    assert anchor in f, 'RTSP anchor not found'
    br=('if (!strcmp(optarg, "TOR")) {\n'
        '          extract_requests = &extract_requests_tor;\n'
        '          extract_response_codes = &extract_response_codes_tor;\n'
        '        } else ')
    f=f.replace(anchor, br+anchor, 1)
    open(base+'/afl-fuzz.c','w').write(f)
    print('afl-fuzz.c patched')
print('done')

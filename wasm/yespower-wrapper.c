#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#include <emscripten/emscripten.h>
#include "yespower.h"

static yespower_local_t local;
static int local_initialized = 0;
static const uint8_t zero_personalization[32] = {0};

static int ensure_local(void) {
  if (!local_initialized) {
    if (yespower_init_local(&local) != 0) return -1;
    local_initialized = 1;
  }
  return 0;
}

static void write_nonce(uint8_t *input, size_t prefix_len, uint64_t nonce) {
  for (int i = 0; i < 8; ++i) input[prefix_len + i] = (uint8_t)(nonce >> (8 * i));
}

static int hash_once(const uint8_t *prefix, size_t prefix_len, uint64_t nonce,
                     yespower_binary_t *hash) {
  if (ensure_local() != 0) return -1;
  uint8_t *input = (uint8_t *)malloc(prefix_len + 8);
  if (input == NULL) return -1;
  memcpy(input, prefix, prefix_len);
  write_nonce(input, prefix_len, nonce);
  const yespower_params_t params = {2048, 32, zero_personalization, sizeof(zero_personalization)};
  int result = yespower(&local, input, prefix_len + 8, &params, hash);
  free(input);
  return result;
}

EMSCRIPTEN_KEEPALIVE
int free_reg_hash(const uint8_t *prefix, size_t prefix_len, uint64_t nonce,
                  uint8_t *output) {
  yespower_binary_t hash;
  if (hash_once(prefix, prefix_len, nonce, &hash) != 0) return -1;
  memcpy(output, hash.uc, sizeof(hash.uc));
  return 0;
}

EMSCRIPTEN_KEEPALIVE
uint64_t grind_free_reg_pow(const uint8_t *prefix, size_t prefix_len,
                            uint64_t start, uint64_t stride,
                            uint32_t iterations, uint64_t target) {
  if (ensure_local() != 0) return UINT64_MAX;
  uint8_t *input = (uint8_t *)malloc(prefix_len + 8);
  if (input == NULL) return UINT64_MAX;
  memcpy(input, prefix, prefix_len);
  const yespower_params_t params = {2048, 32, zero_personalization, sizeof(zero_personalization)};
  for (uint32_t i = 0; i < iterations; ++i) {
    const uint64_t nonce = start + (uint64_t)i * stride;
    yespower_binary_t hash;
    write_nonce(input, prefix_len, nonce);
    if (yespower(&local, input, prefix_len + 8, &params, &hash) != 0) {
      free(input);
      return UINT64_MAX;
    }
    uint64_t lead = 0;
    for (int j = 0; j < 8; ++j) lead = (lead << 8) | hash.uc[j];
    if (lead <= target) {
      free(input);
      return nonce;
    }
  }
  free(input);
  return UINT64_MAX;
}

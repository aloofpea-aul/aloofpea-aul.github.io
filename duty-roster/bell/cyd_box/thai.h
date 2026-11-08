// จัดวรรณยุกต์/สระบนไม่ให้ทับกัน — LVGL วาดอักษรไทยทีละตัว ไม่มีระบบจัดตำแหน่งแบบเบราว์เซอร์
// ฟอนต์ที่สร้างไว้มีรูปพิเศษที่ช่อง PUA:
//   U+F700–F704 วรรณยุกต์ยกสูง (เมื่อมีสระบน หรือตามด้วย ำ)
//   U+F705–F709 วรรณยุกต์เยื้องซ้าย (หลัง ป ฝ ฟ ฬ)   U+F70A–F70E ยกสูง + เยื้องซ้าย
//   U+F710–F716 สระบนเยื้องซ้าย ั ิ ี ึ ื ็ ํ (หลัง ป ฝ ฟ ฬ)
#pragma once
#include <Arduino.h>

namespace thai {

static inline bool isCons(uint32_t c) { return c >= 0x0E01 && c <= 0x0E2E; }
static inline bool isTall(uint32_t c) { return c == 0x0E1B || c == 0x0E1D || c == 0x0E1F || c == 0x0E2C; }
static inline int upperIdx(uint32_t c) {
  switch (c) { case 0x0E31: return 0; case 0x0E34: return 1; case 0x0E35: return 2; case 0x0E36: return 3;
               case 0x0E37: return 4; case 0x0E47: return 5; case 0x0E4D: return 6; }
  return -1;
}
static inline int toneIdx(uint32_t c) { return (c >= 0x0E48 && c <= 0x0E4C) ? int(c - 0x0E48) : -1; }

static void putUtf8(String& o, uint32_t c) {
  if (c < 0x80) o += char(c);
  else if (c < 0x800) { o += char(0xC0 | (c >> 6)); o += char(0x80 | (c & 0x3F)); }
  else if (c < 0x10000) { o += char(0xE0 | (c >> 12)); o += char(0x80 | ((c >> 6) & 0x3F)); o += char(0x80 | (c & 0x3F)); }
  else { o += char(0xF0 | (c >> 18)); o += char(0x80 | ((c >> 12) & 0x3F)); o += char(0x80 | ((c >> 6) & 0x3F)); o += char(0x80 | (c & 0x3F)); }
}

static size_t decode(const char* s, uint32_t* out, size_t max) {
  size_t n = 0; const uint8_t* p = (const uint8_t*)s;
  while (*p && n < max) {
    uint32_t c = *p++;
    if (c >= 0xF0) { c = (c & 0x07) << 18; c |= (*p++ & 0x3F) << 12; c |= (*p++ & 0x3F) << 6; c |= (*p++ & 0x3F); }
    else if (c >= 0xE0) { c = (c & 0x0F) << 12; c |= (*p++ & 0x3F) << 6; c |= (*p++ & 0x3F); }
    else if (c >= 0xC0) { c = (c & 0x1F) << 6; c |= (*p++ & 0x3F); }
    out[n++] = c;
  }
  return n;
}

// ใช้กับทุกข้อความก่อนส่งให้ LVGL
static String shape(const char* s) {
  static uint32_t cp[400];
  size_t n = decode(s, cp, 400);
  String o; o.reserve(strlen(s) + 8);
  uint32_t base = 0; bool upper = false;
  for (size_t i = 0; i < n; i++) {
    uint32_t c = cp[i];
    if (isCons(c)) { base = c; upper = false; putUtf8(o, c); continue; }
    int u = upperIdx(c);
    if (u >= 0) { upper = true; putUtf8(o, isTall(base) ? 0xF710 + u : c); continue; }
    int t = toneIdx(c);
    if (t >= 0) {
      bool high = upper || (i + 1 < n && cp[i + 1] == 0x0E33);
      bool left = isTall(base);
      uint32_t r = c;
      if (high && left) r = 0xF70A + t; else if (high) r = 0xF700 + t; else if (left) r = 0xF705 + t;
      putUtf8(o, r); continue;
    }
    if (c < 0x0E00 || c > 0x0E7F) base = 0;
    putUtf8(o, c);
  }
  return o;
}
static inline String shape(const String& s) { return shape(s.c_str()); }

}  // namespace thai

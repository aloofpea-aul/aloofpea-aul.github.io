/* ตั้งค่า LVGL 8.3 สำหรับกล่องกระดิ่งจอทัช (ค่าที่ไม่ได้ระบุใช้ค่าเริ่มต้นของ LVGL) */
#ifndef LV_CONF_H
#define LV_CONF_H
#include <stdint.h>

#define LV_COLOR_DEPTH 16
#define LV_COLOR_16_SWAP 0
#define LV_MEM_CUSTOM 0
#define LV_MEM_SIZE (44U * 1024U)
#define LV_DISP_DEF_REFR_PERIOD 20
#define LV_INDEV_DEF_READ_PERIOD 20
#define LV_TICK_CUSTOM 1
#define LV_TICK_CUSTOM_INCLUDE "Arduino.h"
#define LV_TICK_CUSTOM_SYS_TIME_EXPR (millis())
#define LV_DPI_DEF 130

#define LV_USE_LOG 0
#define LV_USE_PERF_MONITOR 0
#define LV_USE_MEM_MONITOR 0

#define LV_FONT_MONTSERRAT_14 0
#define LV_FONT_CUSTOM_DECLARE LV_FONT_DECLARE(font_th16) LV_FONT_DECLARE(font_th20) LV_FONT_DECLARE(font_th26) LV_FONT_DECLARE(font_th34) LV_FONT_DECLARE(font_clock56)
#define LV_FONT_DEFAULT &font_th16
#define LV_TXT_ENC LV_TXT_ENC_UTF8

#define LV_USE_THEME_DEFAULT 1
#define LV_THEME_DEFAULT_DARK 1
#define LV_THEME_DEFAULT_GROW 0

#define LV_USE_QRCODE 1
#define LV_USE_SNAPSHOT 0
#define LV_USE_GIF 0
#define LV_USE_PNG 0
#define LV_USE_BMP 0
#define LV_USE_SJPG 0
#define LV_USE_FFMPEG 0
#define LV_USE_RLOTTIE 0
#define LV_BUILD_EXAMPLES 0

#endif

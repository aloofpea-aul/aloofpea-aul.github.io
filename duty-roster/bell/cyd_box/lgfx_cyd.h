// จอ ESP32-2432S028 (CYD) — รองรับทั้งชิปจอ ST7789 (รุ่น 2 พอร์ต USB) และ ILI9341 (รุ่นแรก)
// เลือกได้ตอนเปิดเครื่อง (จำไว้ในเครื่อง) · ทัช XPT2046 แยกบัส SPI
#pragma once
#define LGFX_USE_V1
#include <LovyanGFX.hpp>

class LGFX_CYD : public lgfx::LGFX_Device {
 public:
  lgfx::Panel_ST7789 p7789;
  lgfx::Panel_ILI9341 p9341;
  lgfx::Bus_SPI bus;
  lgfx::Light_PWM light;
  lgfx::Touch_XPT2046 touch;

  // mode: bit0 = ILI9341 (0 = ST7789) · bit1 = กลับสี (invert) · bit2 = สลับแดง/น้ำเงิน
  void setup(uint8_t mode) {
    {
      auto c = bus.config();
      c.spi_host = HSPI_HOST; c.spi_mode = 0;
      c.freq_write = 40000000; c.freq_read = 16000000;
      c.spi_3wire = false; c.use_lock = true; c.dma_channel = SPI_DMA_CH_AUTO;
      c.pin_sclk = 14; c.pin_mosi = 13; c.pin_miso = 12; c.pin_dc = 2;
      bus.config(c);
    }
    lgfx::Panel_Device* p = (mode & 1) ? (lgfx::Panel_Device*)&p9341 : (lgfx::Panel_Device*)&p7789;
    p->setBus(&bus);
    {
      auto c = p->config();
      c.pin_cs = 15; c.pin_rst = -1; c.pin_busy = -1;
      c.panel_width = 240; c.panel_height = 320; c.memory_width = 240; c.memory_height = 320;
      c.offset_x = 0; c.offset_y = 0; c.offset_rotation = 0;
      c.dummy_read_pixel = 8; c.dummy_read_bits = 1;
      c.readable = true; c.invert = (mode & 2) != 0; c.rgb_order = (mode & 4) != 0;
      c.dlen_16bit = false; c.bus_shared = false;
      p->config(c);
    }
    {
      auto c = light.config();
      c.pin_bl = 21; c.invert = false; c.freq = 12000; c.pwm_channel = 7;
      light.config(c);
    }
    p->setLight(&light);
    {
      auto c = touch.config();
      c.x_min = 300; c.x_max = 3900; c.y_min = 200; c.y_max = 3800;
      c.pin_int = 36; c.bus_shared = false; c.offset_rotation = 0;
      c.spi_host = VSPI_HOST; c.freq = 1000000;
      c.pin_sclk = 25; c.pin_mosi = 32; c.pin_miso = 39; c.pin_cs = 33;
      touch.config(c);
    }
    p->setTouch(&touch);
    setPanel(p);
  }
};

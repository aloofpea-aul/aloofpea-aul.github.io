# Load01 · วิเคราะห์โหลด กฟต.2 (หลังบ้าน Google Apps Script)

สำเนาโค้ดสำรองของโปรเจกต์ Apps Script "Load01 ซิงค์และวิเคราะห์โหลด กฟต.2"
(ในโปรเจกต์จริงรวมทุกไฟล์ไว้ในไฟล์เดียว และเก็บหน้าเว็บเป็นตัวแปร INDEX_HTML / INDEX_EXT…INDEX_EXT5)

| ไฟล์ | หน้าที่ |
|---|---|
| Code.gs | ตั้งค่า, ซิงค์ไฟล์ Load01 จาก Drive → ชีต, สร้างแคช Dashboard, doGet, สถานะงาน Unbalance |
| Parser.gs | อ่านไฟล์ .xlsx SCADA ทุกรูปแบบ |
| Analysis.gs | สร้างข้อมูล Dashboard (JSON) |
| AlaEngine.gs | ดึงข้อมูล SLD อ่าวลึกจาก GitHub → ไลน์แยก 1 เฟส + โหลดโฟลว์ (สูญเสีย/แรงดันตก/Capacitor) |
| SubCap.gs | ชีต Substations (ขนาดหม้อแปลง) สำหรับ N-1 |
| Api.gs | doPost ให้หน้าเว็บบน GitHub เรียกหลังบ้าน (เฉพาะฟังก์ชันที่อนุญาต) |
| Index*.html | หน้าเว็บ (ฐาน + ส่วนขยาย Unbalance/โหลด, ตัวกรอง, เจาะลึก ALA, วางแผนระบบ, N-1) |

หน้าเว็บในศูนย์รวมงาน: `/load01/index.html` = Index.html + IndexExt…IndexExt5 รวมกัน
พร้อมตัวแทน `google.script.run` ที่เรียก Web app ผ่าน fetch

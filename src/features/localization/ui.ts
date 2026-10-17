import { useLanguage } from './context';
const english: Record<string, string> = {
  'ภาพรวม': 'Overview', 'สกิล': 'Skills', 'ค่าสถานะ': 'Stats', 'รายการสกิล': 'Skill list',
  'ลำดับสกิล': 'Skill priority', 'การเติบโตทุกระดับ': 'Level growth', 'การเลื่อนขั้น': 'Promotion',
  'โปรไฟล์และเรื่องราว': 'Profile and story', 'รูปลักษณ์': 'Outfits', 'วัสดุ': 'Materials',
  'ค่าสถานะหลัก': 'Main stat', 'ค่าสถานะรอง': 'Sub stat', 'ระดับดาว': 'Star levels',
  'โบนัส / คำอธิบายเพิ่มเติม': 'Bonus / description', 'โบนัส 4 ชิ้น': '4-piece bonus',
  'คำอธิบายย่อ': 'Short description', 'คำอธิบาย': 'Description', 'เรื่องราว': 'Story',
  'รายละเอียด Potential': 'Potential details', 'คำแนะนำจากต้นทาง': 'Source recommendations',
  'แนวทางจากต้นทาง': 'Source strategy', 'ก่อนหน้า': 'Previous', 'ถัดไป': 'Next', 'หน้าแรก': 'First page',
  'หน้าสุดท้าย': 'Last page', 'ทั้งหมด': 'All', 'ระดับ': 'Rarity', 'กลุ่ม / ธาตุ': 'Group / element',
  'ฝ่าย / Faction': 'Faction', 'ประเภท / Specialty': 'Specialty', 'เวอร์ชันข้อมูล': 'Game version',
  'ค้นหาชื่อหรือ ID': 'Search name or ID', 'ค้นหาฐานข้อมูล…': 'Search database…',
  '← กลับไปรายการ': '← Back to list', 'แหล่งข้อมูล': 'Data sources',
};
export function useUiText() { const { locale } = useLanguage(); return (value: string) => locale === 'en-US' ? english[value] ?? value : value; }

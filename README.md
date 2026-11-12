# 🍿 Popcorn Diary

สมุดบันทึกหนังและซีรีส์ที่ดู ใส่โปสเตอร์เอง ให้คะแนน เขียนรีวิว และจดว่าดูวันไหน กี่โมง ดูจากแพลตฟอร์มออนไลน์หรือที่โรงหนัง

- เว็บเปิดบน Mac ได้ และติดตั้งบนมือถือได้เหมือนแอป (PWA)
- ข้อมูลเก็บใน [Supabase](https://supabase.com) ซิงก์กันทุกเครื่องที่ล็อกอินบัญชีเดียวกัน
- เขียนด้วย HTML / CSS / JavaScript ล้วน ไม่ต้อง build

## โครงสร้างไฟล์

```
index.html              หน้าเว็บ
style.css               ธีมสีพาสเทล (รองรับโหมดมืด)
app.js                  โค้ดแอปทั้งหมด
config.js               ค่า Supabase ของคุณ
manifest.webmanifest    ข้อมูลสำหรับติดตั้งเป็นแอปบนมือถือ
sw.js                   service worker (เปิดแอปเร็วขึ้น)
icons/                  ไอคอนแอป
supabase/schema.sql     สร้างตาราง ที่เก็บรูป และสิทธิ์การเข้าถึง
```

## ตั้งค่า (ทำครั้งเดียว)

### 1. สร้างโปรเจกต์ Supabase

1. สมัครและสร้างโปรเจกต์ใหม่ที่ <https://supabase.com> (แพ็กเกจฟรีพอ)
2. ไปที่ **SQL Editor** → New query → วางเนื้อหาไฟล์ `supabase/schema.sql` → กด **Run**
3. ไปที่ **Project Settings → API** คัดลอก **Project URL** และ **anon public key**
4. เปิด `config.js` แล้ววางทั้งสองค่าแทน `YOUR-PROJECT-ID` และ `YOUR-ANON-KEY`

> anon key เป็นคีย์สาธารณะ ใส่ใน GitHub ได้ ข้อมูลถูกป้องกันด้วย Row Level Security ทุกคนเห็นได้เฉพาะของตัวเอง
> **ห้าม** ใส่ `service_role` key ลงในโค้ดเด็ดขาด

### 2. ขึ้น GitHub Pages

```bash
git init
git add .
git commit -m "Popcorn Diary"
git branch -M main
git remote add origin https://github.com/<username>/popcorn-diary.git
git push -u origin main
```

จากนั้นใน GitHub: **Settings → Pages → Source: Deploy from a branch → main / (root)** → Save
รอสักครู่ เว็บจะอยู่ที่ `https://<username>.github.io/popcorn-diary/`

### 3. บอก Supabase ว่าเว็บอยู่ที่ไหน

ใน Supabase ไปที่ **Authentication → URL Configuration**

- **Site URL**: `https://<username>.github.io/popcorn-diary/`
- **Redirect URLs**: เพิ่ม URL เดียวกัน (และ `http://localhost:8000/` ถ้าจะทดสอบในเครื่อง)

ลิงก์ยืนยันอีเมลตอนสมัครจะพากลับมาที่เว็บนี้

> ใช้คนเดียว ไม่อยากยืนยันอีเมล: ปิดได้ที่ **Authentication → Providers → Email → Confirm email**
> พอสมัครบัญชีตัวเองแล้ว จะปิดการสมัครเพิ่มก็ได้ที่ **Authentication → Settings → Allow new users to sign up**

## ใช้งาน

**บน Mac**: เปิด URL ของ GitHub Pages ใน Safari หรือ Chrome แล้วเข้าสู่ระบบ
(Safari บน macOS Sonoma ขึ้นไป: File → Add to Dock จะได้เป็นแอปแยกบน Dock)

**บน iPhone**: เปิด URL ใน Safari → ปุ่มแชร์ → **เพิ่มไปยังหน้าจอโฮม**
**บน Android**: เปิดใน Chrome → เมนู ⋮ → **ติดตั้งแอป** หรือ **เพิ่มลงในหน้าจอหลัก**

แอปบนหน้าจอโฮมต้องเข้าสู่ระบบอีกครั้งในครั้งแรก

## ทดสอบในเครื่อง

```bash
python3 -m http.server 8000
```

แล้วเปิด <http://localhost:8000> (service worker ทำงานเฉพาะบน `localhost` หรือ `https`)

## แก้ไขแล้วมือถือยังเห็นของเก่า

เปลี่ยนเลขใน `sw.js` บรรทัด `const CACHE = "popcorn-v1"` เป็น `popcorn-v2` แล้ว push ใหม่ แอปจะโหลดไฟล์ใหม่เมื่อเปิดครั้งถัดไป

## ปรับแต่ง

- รายชื่อแพลตฟอร์มและโรงหนัง: แก้ `PLATFORMS` และ `CINEMAS` ด้านบนของ `app.js`
- สีธีม: แก้ตัวแปรใน `:root` ด้านบนของ `style.css`

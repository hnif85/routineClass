-- ============================================
-- RESET DATABASE: Hapus seluruh data production
-- Jalankan di Supabase SQL Editor (Production)
-- Schema: routine_class
-- ============================================

-- Hapus storage files dulu
-- (lakukan manual dari Supabase Dashboard > Storage)

-- Child tables dulu (yang punya foreign key)
DELETE FROM routine_class.test_answers;
DELETE FROM routine_class.wa_conversations;
DELETE FROM routine_class.event_tests;
DELETE FROM routine_class.event_materials;
DELETE FROM routine_class.event_trainers;
DELETE FROM routine_class.event_apps;
DELETE FROM routine_class.event_invitations;
DELETE FROM routine_class.certificates;

-- Intermediate tables
DELETE FROM routine_class.test_questions;
DELETE FROM routine_class.test_phases;
DELETE FROM routine_class.event_tests;

-- Parent tables
DELETE FROM routine_class.events;
DELETE FROM routine_class.materials;
DELETE FROM routine_class.tests;
DELETE FROM routine_class.umkm;
DELETE FROM routine_class.cms_customers;

-- Reset sequences/auto-increment jika ada
-- (tidak perlu karena pakai UUID)

-- ============================================
-- TABEL YANG TIDAK DIHAPUS (konfigurasi):
--   admin_users, users, master_apps,
--   certificate_templates, app_config
-- ============================================

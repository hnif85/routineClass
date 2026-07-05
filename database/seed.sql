-- ============================================================
-- SEED DATA: Tests, Questions, Bindings, Answers
-- Schema: routine_class
-- Pupuk Kaltim UMKM Connect
-- ============================================================
-- Cara pakai: jalankan di Supabase SQL Editor atau via psql
-- ============================================================

-- ═══════════════════════════════════════════════════════════════
-- 1. MASTER TEST + PHASES + QUESTIONS
-- ═══════════════════════════════════════════════════════════════

-- 1a. Digital Marketing Dasar (type: test → pre + post)
WITH t AS (
  INSERT INTO routine_class.tests (id, name, description, type) VALUES
    (gen_random_uuid(), 'Digital Marketing Dasar', 'Test kemampuan dasar digital marketing untuk UMKM', 'test')
  RETURNING id
),
pre AS (
  INSERT INTO routine_class.test_phases (id, test_id, phase, label, sort_order)
  SELECT gen_random_uuid(), t.id, 'pre', 'Pre-Test', 0 FROM t
  RETURNING id
),
post AS (
  INSERT INTO routine_class.test_phases (id, test_id, phase, label, sort_order)
  SELECT gen_random_uuid(), t.id, 'post', 'Post-Test', 1 FROM t
  RETURNING id
)
-- Pre-Test questions (4 soal: 3 MCQ + 1 Essay)
INSERT INTO routine_class.test_questions (id, phase_id, question_text, question_type, options, correct_answer, points, sort_order)
SELECT gen_random_uuid(), pre.id, 'Apa yang dimaksud dengan digital marketing?', 'multiple_choice',
  '["Pemasaran menggunakan media cetak","Pemasaran menggunakan platform digital & internet","Pemasaran dari mulut ke mulut","Pemasangan spanduk di jalan"]'::jsonb,
  'Pemasaran menggunakan platform digital & internet', 10, 0
FROM pre;

INSERT INTO routine_class.test_questions (id, phase_id, question_text, question_type, points, sort_order)
SELECT gen_random_uuid(), pre.id, 'Sebutkan 3 platform media sosial yang paling populer di Indonesia!', 'essay', 10, 1
FROM pre;

INSERT INTO routine_class.test_questions (id, phase_id, question_text, question_type, options, correct_answer, points, sort_order)
SELECT gen_random_uuid(), pre.id, 'Apa kepanjangan dari SEO?', 'multiple_choice',
  '["Social Engagement Optimization","Search Engine Optimization","Sales Engagement Online","System Efficiency Output"]'::jsonb,
  'Search Engine Optimization', 10, 2
FROM pre;

INSERT INTO routine_class.test_questions (id, phase_id, question_text, question_type, options, correct_answer, points, sort_order)
SELECT gen_random_uuid(), pre.id, 'Apa manfaat utama Google Business Profile untuk UMKM?', 'multiple_choice',
  '["Membuat website gratis","Meningkatkan visibilitas di Google Maps & Search","Mengirim email marketing","Membuat toko online otomatis"]'::jsonb,
  'Meningkatkan visibilitas di Google Maps & Search', 10, 3
FROM pre;

-- Post-Test questions (3 soal: 1 MCQ + 2 Essay)
INSERT INTO routine_class.test_questions (id, phase_id, question_text, question_type, points, sort_order)
SELECT gen_random_uuid(), post.id, 'Setelah mengikuti pelatihan, strategi digital marketing apa yang paling cocok untuk usaha Anda? Jelaskan alasannya.', 'essay', 15, 0
FROM post;

INSERT INTO routine_class.test_questions (id, phase_id, question_text, question_type, options, correct_answer, points, sort_order)
SELECT gen_random_uuid(), post.id, 'Apa yang dimaksud dengan konten marketing?', 'multiple_choice',
  '["Membuat konten iklan berbayar","Membuat & mendistribusikan konten berharga untuk menarik audiens","Menjual produk via WhatsApp","Mengirim brosur ke rumah pelanggan"]'::jsonb,
  'Membuat & mendistribusikan konten berharga untuk menarik audiens', 10, 1
FROM post;

INSERT INTO routine_class.test_questions (id, phase_id, question_text, question_type, points, sort_order)
SELECT gen_random_uuid(), post.id, 'Sebutkan 3 cara meningkatkan penjualan melalui media sosial untuk usaha Anda!', 'essay', 15, 2
FROM post;

-- 1b. Kepuasan Pelatihan (type: kuesioner → phase: only)
WITH kt AS (
  INSERT INTO routine_class.tests (id, name, description, type) VALUES
    (gen_random_uuid(), 'Kepuasan Pelatihan Digital Marketing', 'Kuesioner kepuasan peserta pelatihan digital marketing', 'kuesioner')
  RETURNING id
),
kues_phase AS (
  INSERT INTO routine_class.test_phases (id, test_id, phase, label, sort_order)
  SELECT gen_random_uuid(), kt.id, 'only', 'Kuesioner Kepuasan', 0 FROM kt
  RETURNING id
)
INSERT INTO routine_class.test_questions (id, phase_id, question_text, question_type, options, points, sort_order)
VALUES
  (gen_random_uuid(), (SELECT id FROM kues_phase), 'Bagaimana penilaian Anda terhadap materi pelatihan secara keseluruhan?', 'multiple_choice',
   '["Sangat Baik","Baik","Cukup","Kurang"]'::jsonb, 1, 0),
  (gen_random_uuid(), (SELECT id FROM kues_phase), 'Apakah pelatihan ini membantu mengembangkan bisnis Anda?', 'multiple_choice',
   '["Sangat Membantu","Membantu","Cukup","Tidak Membantu"]'::jsonb, 1, 1),
  (gen_random_uuid(), (SELECT id FROM kues_phase), 'Apa saran Anda untuk pelatihan selanjutnya?', 'essay', 1, 2),
  (gen_random_uuid(), (SELECT id FROM kues_phase), 'Seberapa puas Anda dengan cara penyampaian narasumber?', 'multiple_choice',
   '["Sangat Puas","Puas","Cukup","Kurang Puas"]'::jsonb, 1, 3);

-- ═══════════════════════════════════════════════════════════════
-- 2. BIND TESTS TO EVENTS
-- ═══════════════════════════════════════════════════════════════
-- Ganti UUID event_id dengan ID event yang sudah ada di database Anda.
-- Contoh di bawah menggunakan 2 event sample.

INSERT INTO routine_class.event_tests (event_id, phase_id, open_time, is_open)
SELECT
  e.id AS event_id,
  tp.id AS phase_id,
  CASE
    WHEN tp.label = 'Pre-Test' THEN 'before'
    WHEN tp.label = 'Post-Test' THEN 'after'
    ELSE 'after'
  END AS open_time,
  true AS is_open
FROM routine_class.events e
CROSS JOIN routine_class.test_phases tp
JOIN routine_class.tests t ON t.id = tp.test_id
WHERE e.title = 'Pelatihan Digital Marketing UMKM';

-- Untuk event kedua, bind hanya kuesioner
INSERT INTO routine_class.event_tests (event_id, phase_id, open_time, is_open)
SELECT
  e.id, tp.id, 'during', true
FROM routine_class.events e
CROSS JOIN routine_class.test_phases tp
JOIN routine_class.tests t ON t.id = tp.test_id
WHERE e.title = 'Bazar UMKM Bontang 2026'
  AND tp.label = 'Kuesioner Kepuasan';

-- ═══════════════════════════════════════════════════════════════
-- 3. INVITATIONS
-- ═══════════════════════════════════════════════════════════════
-- Ganti umkm_id dengan ID UMKM yang ada.
INSERT INTO routine_class.event_invitations (event_id, umkm_id, status, sent_at)
SELECT e.id, u.id, 'attended', now() - interval '2 days'
FROM routine_class.events e, routine_class.umkm u
WHERE e.title = 'Pelatihan Digital Marketing UMKM'
  AND u.business_name IN ('Andi Bakery', 'Rahayu Craft');

INSERT INTO routine_class.event_invitations (event_id, umkm_id, status, sent_at)
SELECT e.id, u.id, 'sent', now() - interval '2 days'
FROM routine_class.events e, routine_class.umkm u
WHERE e.title = 'Pelatihan Digital Marketing UMKM'
  AND u.business_name = 'Santoso Furniture';

INSERT INTO routine_class.event_invitations (event_id, umkm_id, status, sent_at)
SELECT e.id, u.id, 'rsvp_yes', now()
FROM routine_class.events e, routine_class.umkm u
WHERE e.title = 'Bazar UMKM Bontang 2026'
  AND u.business_name = 'Dewi Kosmetik';

INSERT INTO routine_class.event_invitations (event_id, umkm_id, status, sent_at)
SELECT e.id, u.id, 'sent', now()
FROM routine_class.events e, routine_class.umkm u
WHERE e.title = 'Bazar UMKM Bontang 2026'
  AND u.business_name = 'Fitri Fashion';

-- ═══════════════════════════════════════════════════════════════
-- 4. SAMPLE ANSWERS
-- ═══════════════════════════════════════════════════════════════

-- 4a. Pre-Test: Andi Bakery
INSERT INTO routine_class.test_answers (question_id, event_id, umkm_id, answer_text, score, submitted_at)
SELECT q.id, e.id, u.id,
  CASE q.question_text
    WHEN 'Apa yang dimaksud dengan digital marketing?' THEN 'Pemasaran menggunakan platform digital & internet'
    WHEN 'Sebutkan 3 platform media sosial yang paling populer di Indonesia!' THEN 'Instagram, Facebook, dan TikTok'
    WHEN 'Apa kepanjangan dari SEO?' THEN 'Search Engine Optimization'
    WHEN 'Apa manfaat utama Google Business Profile untuk UMKM?' THEN 'Meningkatkan visibilitas di Google Maps & Search'
  END,
  CASE q.question_text
    WHEN 'Apa yang dimaksud dengan digital marketing?' THEN 10
    WHEN 'Sebutkan 3 platform media sosial yang paling populer di Indonesia!' THEN 8
    WHEN 'Apa kepanjangan dari SEO?' THEN 10
    WHEN 'Apa manfaat utama Google Business Profile untuk UMKM?' THEN 10
  END,
  now() - interval '1 day'
FROM routine_class.test_questions q
CROSS JOIN routine_class.events e
CROSS JOIN routine_class.umkm u
WHERE e.title = 'Pelatihan Digital Marketing UMKM'
  AND u.business_name = 'Andi Bakery'
  AND q.phase_id = (SELECT tp.id FROM routine_class.test_phases tp JOIN routine_class.tests t ON t.id = tp.test_id WHERE tp.label = 'Pre-Test' AND t.name = 'Digital Marketing Dasar' LIMIT 1);

-- 4b. Pre-Test: Rahayu Craft
INSERT INTO routine_class.test_answers (question_id, event_id, umkm_id, answer_text, score, submitted_at)
SELECT q.id, e.id, u.id,
  CASE q.question_text
    WHEN 'Apa yang dimaksud dengan digital marketing?' THEN 'Pemasaran menggunakan platform digital & internet'
    WHEN 'Sebutkan 3 platform media sosial yang paling populer di Indonesia!' THEN 'Facebook, Instagram, YouTube'
    WHEN 'Apa kepanjangan dari SEO?' THEN 'Social Engagement Optimization'
    WHEN 'Apa manfaat utama Google Business Profile untuk UMKM?' THEN 'Membuat website gratis'
  END,
  CASE q.question_text
    WHEN 'Apa yang dimaksud dengan digital marketing?' THEN 10
    WHEN 'Sebutkan 3 platform media sosial yang paling populer di Indonesia!' THEN 9
    WHEN 'Apa kepanjangan dari SEO?' THEN 0
    WHEN 'Apa manfaat utama Google Business Profile untuk UMKM?' THEN 0
  END,
  now() - interval '20 hours'
FROM routine_class.test_questions q
CROSS JOIN routine_class.events e
CROSS JOIN routine_class.umkm u
WHERE e.title = 'Pelatihan Digital Marketing UMKM'
  AND u.business_name = 'Rahayu Craft'
  AND q.phase_id = (SELECT tp.id FROM routine_class.test_phases tp JOIN routine_class.tests t ON t.id = tp.test_id WHERE tp.label = 'Pre-Test' AND t.name = 'Digital Marketing Dasar' LIMIT 1);

-- 4c. Post-Test: Andi Bakery
INSERT INTO routine_class.test_answers (question_id, event_id, umkm_id, answer_text, score, submitted_at)
SELECT q.id, e.id, u.id,
  CASE q.question_text
    WHEN 'Setelah mengikuti pelatihan, strategi digital marketing apa yang paling cocok untuk usaha Anda? Jelaskan alasannya.' THEN 'Saya akan fokus menggunakan Instagram untuk promosi produk bakery karena banyak pelanggan saya di sana. Juga akan memanfaatkan Google Business Profile agar toko saya muncul di pencarian Google.'
    WHEN 'Apa yang dimaksud dengan konten marketing?' THEN 'Membuat & mendistribusikan konten berharga untuk menarik audiens'
    WHEN 'Sebutkan 3 cara meningkatkan penjualan melalui media sosial untuk usaha Anda!' THEN '1) Posting konten foto produk setiap hari, 2) Menggunakan iklan Instagram ads, 3) Kolaborasi dengan food blogger lokal'
  END,
  CASE q.question_text
    WHEN 'Setelah mengikuti pelatihan, strategi digital marketing apa yang paling cocok untuk usaha Anda? Jelaskan alasannya.' THEN 12
    WHEN 'Apa yang dimaksud dengan konten marketing?' THEN 10
    WHEN 'Sebutkan 3 cara meningkatkan penjualan melalui media sosial untuk usaha Anda!' THEN 12
  END,
  now() - interval '3 hours'
FROM routine_class.test_questions q
CROSS JOIN routine_class.events e
CROSS JOIN routine_class.umkm u
WHERE e.title = 'Pelatihan Digital Marketing UMKM'
  AND u.business_name = 'Andi Bakery'
  AND q.phase_id = (SELECT tp.id FROM routine_class.test_phases tp JOIN routine_class.tests t ON t.id = tp.test_id WHERE tp.label = 'Post-Test' AND t.name = 'Digital Marketing Dasar' LIMIT 1);

-- 4d. Post-Test: Rahayu Craft
INSERT INTO routine_class.test_answers (question_id, event_id, umkm_id, answer_text, score, submitted_at)
SELECT q.id, e.id, u.id,
  CASE q.question_text
    WHEN 'Setelah mengikuti pelatihan, strategi digital marketing apa yang paling cocok untuk usaha Anda? Jelaskan alasannya.' THEN 'Strategi yang cocok adalah menggunakan Facebook dan WhatsApp Business untuk memasarkan produk kerajinan tangan saya.'
    WHEN 'Apa yang dimaksud dengan konten marketing?' THEN 'Membuat & mendistribusikan konten berharga untuk menarik audiens'
    WHEN 'Sebutkan 3 cara meningkatkan penjualan melalui media sosial untuk usaha Anda!' THEN '1) Promo khusus pelanggan setia di Facebook, 2) Membuat video proses pembuatan kerajinan, 3) Respon cepat ke pelanggan via WhatsApp'
  END,
  CASE q.question_text
    WHEN 'Setelah mengikuti pelatihan, strategi digital marketing apa yang paling cocok untuk usaha Anda? Jelaskan alasannya.' THEN 10
    WHEN 'Apa yang dimaksud dengan konten marketing?' THEN 10
    WHEN 'Sebutkan 3 cara meningkatkan penjualan melalui media sosial untuk usaha Anda!' THEN 10
  END,
  now() - interval '2 hours'
FROM routine_class.test_questions q
CROSS JOIN routine_class.events e
CROSS JOIN routine_class.umkm u
WHERE e.title = 'Pelatihan Digital Marketing UMKM'
  AND u.business_name = 'Rahayu Craft'
  AND q.phase_id = (SELECT tp.id FROM routine_class.test_phases tp JOIN routine_class.tests t ON t.id = tp.test_id WHERE tp.label = 'Post-Test' AND t.name = 'Digital Marketing Dasar' LIMIT 1);

-- 4e. Kuesioner Anonim → Event 1 (3 responses)
INSERT INTO routine_class.test_answers (question_id, event_id, umkm_id, answer_text, submitted_at)
SELECT q.id, e.id, NULL,
  CASE q.row_num
    WHEN 1 THEN
      CASE q.question_text
        WHEN 'Bagaimana penilaian Anda terhadap materi pelatihan secara keseluruhan?' THEN 'Sangat Baik'
        WHEN 'Apakah pelatihan ini membantu mengembangkan bisnis Anda?' THEN 'Sangat Membantu'
        WHEN 'Apa saran Anda untuk pelatihan selanjutnya?' THEN 'Pelatihannya bagus, tambahin sesi praktek langsung biar lebih paham'
        WHEN 'Seberapa puas Anda dengan cara penyampaian narasumber?' THEN 'Sangat Puas'
      END
    WHEN 2 THEN
      CASE q.question_text
        WHEN 'Bagaimana penilaian Anda terhadap materi pelatihan secara keseluruhan?' THEN 'Baik'
        WHEN 'Apakah pelatihan ini membantu mengembangkan bisnis Anda?' THEN 'Membantu'
        WHEN 'Apa saran Anda untuk pelatihan selanjutnya?' THEN 'Materi sudah bagus, mungkin bisa ditambah studi kasus UMKM sukses'
        WHEN 'Seberapa puas Anda dengan cara penyampaian narasumber?' THEN 'Puas'
      END
    WHEN 3 THEN
      CASE q.question_text
        WHEN 'Bagaimana penilaian Anda terhadap materi pelatihan secara keseluruhan?' THEN 'Cukup'
        WHEN 'Apakah pelatihan ini membantu mengembangkan bisnis Anda?' THEN 'Cukup'
        WHEN 'Apa saran Anda untuk pelatihan selanjutnya?' THEN 'Semoga next ada pelatihan tentang cara bikin konten video'
        WHEN 'Seberapa puas Anda dengan cara penyampaian narasumber?' THEN 'Cukup'
      END
  END,
  now() - make_interval(hours => (3 - q.row_num))
FROM (
  SELECT q.*, ROW_NUMBER() OVER (PARTITION BY q.phase_id ORDER BY q.sort_order) AS row_num
  FROM routine_class.test_questions q
  JOIN routine_class.test_phases tp ON tp.id = q.phase_id
  JOIN routine_class.tests t ON t.id = tp.test_id
  WHERE t.name = 'Kepuasan Pelatihan Digital Marketing'
) q
CROSS JOIN routine_class.events e
CROSS JOIN (SELECT generate_series(1, 3) AS row_num) r
WHERE e.title = 'Pelatihan Digital Marketing UMKM';

-- 4f. Kuesioner Anonim → Event 2 (1 response)
INSERT INTO routine_class.test_answers (question_id, event_id, umkm_id, answer_text, submitted_at)
SELECT q.id, e.id, NULL,
  CASE q.question_text
    WHEN 'Bagaimana penilaian Anda terhadap materi pelatihan secara keseluruhan?' THEN 'Baik'
    WHEN 'Apakah pelatihan ini membantu mengembangkan bisnis Anda?' THEN 'Membantu'
    WHEN 'Apa saran Anda untuk pelatihan selanjutnya?' THEN 'Bazar tahun ini lebih meriah, semoga tahun depan lebih besar lagi'
    WHEN 'Seberapa puas Anda dengan cara penyampaian narasumber?' THEN 'Puas'
  END,
  now()
FROM routine_class.test_questions q
JOIN routine_class.test_phases tp ON tp.id = q.phase_id
JOIN routine_class.tests t ON t.id = tp.test_id
CROSS JOIN routine_class.events e
WHERE t.name = 'Kepuasan Pelatihan Digital Marketing'
  AND e.title = 'Bazar UMKM Bontang 2026';

-- ═══════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════
SELECT 'tests' AS tbl, COUNT(*)::text AS cnt FROM routine_class.tests
UNION ALL SELECT 'test_phases', COUNT(*)::text FROM routine_class.test_phases
UNION ALL SELECT 'test_questions', COUNT(*)::text FROM routine_class.test_questions
UNION ALL SELECT 'event_tests', COUNT(*)::text FROM routine_class.event_tests
UNION ALL SELECT 'event_invitations', COUNT(*)::text FROM routine_class.event_invitations
UNION ALL SELECT 'test_answers', COUNT(*)::text FROM routine_class.test_answers
ORDER BY tbl;

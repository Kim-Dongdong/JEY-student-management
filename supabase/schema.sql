-- =============================================
-- 학생 관리 시스템 스키마
-- =============================================

-- 수업 테이블
CREATE TABLE classes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  schedule    TEXT NOT NULL, -- 예: "월/수 19:00~20:30"
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 학생 테이블
CREATE TABLE students (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  note        TEXT,           -- 특이사항
  order_num   INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 수업 회차 테이블 (날짜별 생성)
CREATE TABLE sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  time_range  TEXT,           -- 예: "18:00~20:00"
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, date)
);

-- 기존 DB에 컬럼 추가할 때 실행:
-- ALTER TABLE sessions ADD COLUMN IF NOT EXISTS time_range TEXT;

-- 테스트 항목 테이블 (회차별 동적 컬럼)
-- 예: "단어 TEST", "선택형 테스트", "7대 영역 7~10"
CREATE TABLE test_columns (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,                          -- 테스트 이름
  type        TEXT NOT NULL CHECK (type IN ('word', 'review', 'custom')),
  order_num   INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 학생 출결/숙제 기록 테이블 (회차별 × 학생별)
CREATE TABLE student_records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  attendance       TEXT NOT NULL DEFAULT 'present'
                     CHECK (attendance IN ('present', 'absent', 'late')),
  homework_status  TEXT NOT NULL DEFAULT 'done'
                     CHECK (homework_status IN ('done', 'undone')),
  next_homework    TEXT,   -- 다음 수업까지 숙제 텍스트
  note             TEXT,   -- 특이사항 메모
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id)
);

-- 테스트 결과 테이블 (student_record × test_column)
-- result 예시: "P", "X", "P(74/80)", "수요일"
CREATE TABLE test_results (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_record_id UUID NOT NULL REFERENCES student_records(id) ON DELETE CASCADE,
  test_column_id    UUID NOT NULL REFERENCES test_columns(id) ON DELETE CASCADE,
  result            TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_record_id, test_column_id)
);

-- =============================================
-- 인덱스
-- =============================================

CREATE INDEX idx_students_class_id      ON students(class_id);
CREATE INDEX idx_sessions_class_id      ON sessions(class_id);
CREATE INDEX idx_sessions_date          ON sessions(date);
CREATE INDEX idx_test_columns_session   ON test_columns(session_id);
CREATE INDEX idx_student_records_session  ON student_records(session_id);
CREATE INDEX idx_student_records_student  ON student_records(student_id);
CREATE INDEX idx_test_results_record    ON test_results(student_record_id);
CREATE INDEX idx_test_results_column    ON test_results(test_column_id);

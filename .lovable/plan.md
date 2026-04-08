# BossCoder HR — Employee Appraisal Platform (Revised)

## Change from Previous Plan

- Removed "pending submissions" — forms are not mandatory
- Added pre-seeded employee: **harsh.bhardwaj@bosscoderacademy.com** (Employee role)

## Overview

Modern, minimalistic HR appraisal platform for Bosscoder Academy. Branding: white, **#1371FF**, **#0F2368**. Koda-style layout — left sidebar, clean cards, breadcrumbs.

## Auth & Access

- Lovable Cloud (Supabase) backend
- Google + Email/Password login, restricted to `@bosscoderacademy.com`
- Roles: HR Manager, HR, Employee (stored in `user_roles` table)
- No signup — pre-seeded users:
  - shruti.jain@bosscoderacademy.com (HR Manager)
  - shreya.gupta@bosscoderacademy.com (HR)
  - charvi.madaan@bosscoderacademy.com (HR)
  - harsh.bhardwaj@bosscoderacademy.com (Employee)

## Pages

### 1. Login Page

- Company logo, Google sign-in + email/password, domain validation

### 2. Admin Panel (HR roles)

- **Sidebar**: Dashboard, Forms, Responses
- **Dashboard**: Total forms created, total responses received
- **Form Builder**: Structured creator — sections, question types (text, textarea, dropdown, star rating), preview, shareable link
- **Responses/Analytics**: Grid of employee tiles (name + email) for those who submitted. Click tile → full response detail view.

### 3. Employee View

- See available forms via shared link (must be logged in)
- Typeform-like form experience with progress indicator
- Auto-fills name/email from login
- Submit once, no editing after

## Database Schema

- **profiles** — user_id, full_name, email, department, job_title, date_of_joining
- **user_roles** — user_id, role (hr_manager, hr, employee)
- **forms** — id, title, description, note, created_by, status, created_at
- **form_sections** — id, form_id, title, order
- **form_questions** — id, section_id, question_text, question_type, options (jsonb), order, required
- **form_responses** — id, form_id, user_id, submitted_at
- **response_answers** — id, response_id, question_id, answer_text, rating_value

## Pre-seeded Data

- Annual Appraisal Form with all sections/questions as specified
- HR team accounts + harsh.bhardwaj as employee, all with appropriate roles

## Implementation Steps

1. Set up Lovable Cloud — auth, database tables, RLS policies
2. Build branded login page with domain restriction
3. Create admin layout — sidebar, dashboard with stats
4. Build structured form builder
5. Build employee typeform-style form view
6. Build responses/analytics — employee tiles grid + detail view
7. Pre-seed all users, roles, and the Annual Appraisal Form
8. Upload company logo and apply branding throughout

--
-- PostgreSQL database dump
--

-- Dumped from database version 16.10 (Debian 16.10-1.pgdg12+1)
-- Dumped by pg_dump version 16.9 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_invite; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_invite (
    id integer NOT NULL,
    token character varying(128) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used boolean,
    created_at timestamp without time zone,
    invited_by integer,
    role_id integer,
    max_uses integer DEFAULT 1,
    current_uses integer DEFAULT 0,
    expires_in_hours integer DEFAULT 24
);


--
-- Name: admin_invite_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admin_invite_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admin_invite_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admin_invite_id_seq OWNED BY public.admin_invite.id;


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id integer NOT NULL,
    user_id integer NOT NULL,
    action character varying(50) NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id integer,
    entity_name character varying(200),
    details text,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp without time zone
);


--
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_log_id_seq OWNED BY public.audit_log.id;


--
-- Name: clergy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clergy (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    rank character varying(100) NOT NULL,
    organization character varying(200),
    date_of_birth date,
    date_of_ordination date,
    ordaining_bishop_id integer,
    date_of_consecration date,
    consecrator_id integer,
    co_consecrators text,
    date_of_death date,
    notes text,
    image_url text,
    image_data text,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp without time zone,
    papal_name character varying(200)
);


--
-- Name: clergy_comment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clergy_comment (
    id integer NOT NULL,
    clergy_id integer NOT NULL,
    author_id integer NOT NULL,
    content text NOT NULL,
    field_name character varying(50),
    is_public boolean,
    is_resolved boolean,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: clergy_comment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.clergy_comment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clergy_comment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.clergy_comment_id_seq OWNED BY public.clergy_comment.id;


--
-- Name: clergy_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.clergy_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clergy_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.clergy_id_seq OWNED BY public.clergy.id;


--
-- Name: co_consecrators; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.co_consecrators (
    consecration_id integer NOT NULL,
    co_consecrator_id integer NOT NULL
);


--
-- Name: consecration; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consecration (
    id integer NOT NULL,
    clergy_id integer NOT NULL,
    date date NOT NULL,
    consecrator_id integer,
    is_sub_conditione boolean NOT NULL,
    is_doubtful boolean NOT NULL,
    is_invalid boolean NOT NULL,
    notes text,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: consecration_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.consecration_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: consecration_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.consecration_id_seq OWNED BY public.consecration.id;


--
-- Name: ordination; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ordination (
    id integer NOT NULL,
    clergy_id integer NOT NULL,
    date date NOT NULL,
    ordaining_bishop_id integer,
    is_sub_conditione boolean NOT NULL,
    is_doubtful boolean NOT NULL,
    is_invalid boolean NOT NULL,
    notes text,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: ordination_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ordination_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ordination_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ordination_id_seq OWNED BY public.ordination.id;


--
-- Name: organization; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    abbreviation character varying(20),
    description text,
    color character varying(7) NOT NULL,
    created_at timestamp without time zone
);


--
-- Name: organization_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.organization_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: organization_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.organization_id_seq OWNED BY public.organization.id;


--
-- Name: permission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permission (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    description text,
    created_at timestamp without time zone
);


--
-- Name: permission_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.permission_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: permission_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.permission_id_seq OWNED BY public.permission.id;


--
-- Name: rank; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rank (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    color character varying(7) NOT NULL,
    created_at timestamp without time zone,
    is_bishop boolean DEFAULT false
);


--
-- Name: rank_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rank_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rank_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rank_id_seq OWNED BY public.rank.id;


--
-- Name: role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    description text,
    created_at timestamp without time zone
);


--
-- Name: role_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.role_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: role_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.role_id_seq OWNED BY public.role.id;


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    role_id integer NOT NULL,
    permission_id integer NOT NULL
);


--
-- Name: user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."user" (
    id integer NOT NULL,
    username character varying(80) NOT NULL,
    password_hash character varying(120) NOT NULL,
    is_admin boolean,
    email character varying(120),
    full_name character varying(200),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_login timestamp without time zone,
    role_id integer
);


--
-- Name: user_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_id_seq OWNED BY public."user".id;


--
-- Name: admin_invite id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_invite ALTER COLUMN id SET DEFAULT nextval('public.admin_invite_id_seq'::regclass);


--
-- Name: audit_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ALTER COLUMN id SET DEFAULT nextval('public.audit_log_id_seq'::regclass);


--
-- Name: clergy id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clergy ALTER COLUMN id SET DEFAULT nextval('public.clergy_id_seq'::regclass);


--
-- Name: clergy_comment id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clergy_comment ALTER COLUMN id SET DEFAULT nextval('public.clergy_comment_id_seq'::regclass);


--
-- Name: consecration id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consecration ALTER COLUMN id SET DEFAULT nextval('public.consecration_id_seq'::regclass);


--
-- Name: ordination id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordination ALTER COLUMN id SET DEFAULT nextval('public.ordination_id_seq'::regclass);


--
-- Name: organization id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization ALTER COLUMN id SET DEFAULT nextval('public.organization_id_seq'::regclass);


--
-- Name: permission id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission ALTER COLUMN id SET DEFAULT nextval('public.permission_id_seq'::regclass);


--
-- Name: rank id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rank ALTER COLUMN id SET DEFAULT nextval('public.rank_id_seq'::regclass);


--
-- Name: role id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role ALTER COLUMN id SET DEFAULT nextval('public.role_id_seq'::regclass);


--
-- Name: user id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user" ALTER COLUMN id SET DEFAULT nextval('public.user_id_seq'::regclass);


--
-- Data for Name: admin_invite; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.admin_invite (id, token, expires_at, used, created_at, invited_by, role_id, max_uses, current_uses, expires_in_hours) FROM stdin;
1	94740d2b-0a39-4791-b19f-122d75175fcb	2025-07-20 21:57:14.68031	f	2025-07-19 21:57:14.683794	1	6	1	0	24
2	53ea1d56-1515-4cfd-88a2-73d0c2a95149	2025-07-23 03:29:01.281462	t	2025-07-22 03:29:01.283432	1	6	1	1	24
\.


--
-- Data for Name: audit_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.audit_log (id, user_id, action, entity_type, entity_id, entity_name, details, ip_address, user_agent, created_at) FROM stdin;
1	1	update	clergy	2	Joseph S. Selway	{"rank": "Bishop", "organization": "Roman Catholic Institute", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 1, "co_consecrators": []}	10.204.184.207	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-07-19 20:14:10.740637
2	1	generate_invite	admin_invite	1	User invite for 94740d2b...	{"token": "94740d2b-0a39-4791-b19f-122d75175fcb", "expires_at": "2025-07-20T21:57:14.680310", "invited_by": 1, "role_id": "6", "role_name": "Admin", "expires_in_hours": 24, "max_uses": 1}	10.204.153.71	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-07-19 21:57:14.695954
3	1	logout	user	1	admin	\N	10.204.87.179	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-07-19 22:02:28.882102
4	1	login	user	1	admin	{"login_method": "password"}	10.204.184.207	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-07-19 22:02:35.029754
5	1	create	rank	2	Priest	{"name": "Priest", "description": "", "color": "#000000"}	10.204.118.37	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-07-20 03:12:24.808949
6	1	create	organization	2	Independent	{"name": "Independent", "abbreviation": "IND", "description": "", "color": "#919191"}	10.204.53.76	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-07-20 03:12:51.491652
7	1	update	organization	1	Roman Catholic Institute	{"old_name": "Roman Catholic Institute", "new_name": "Roman Catholic Institute", "abbreviation": "RCI", "description": "", "color": "#b12525"}	10.204.9.242	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-07-20 03:13:01.833636
8	1	update	clergy	3	Germán Fliess	{"rank": "Bishop", "organization": "Roman Catholic Institute", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": 1, "consecrator_id": 1, "co_consecrators": []}	10.204.184.207	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-07-20 03:13:58.074953
9	1	update	clergy	7	Philip A. Eldracher	{"rank": "Priest", "organization": "Roman Catholic Institute", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": 1, "consecrator_id": null, "co_consecrators": []}	10.204.53.76	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-07-20 03:14:27.26235
10	1	update	clergy	13	Gregory Barnes	{"rank": "Priest", "organization": "Roman Catholic Institute", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": 1, "consecrator_id": null, "co_consecrators": []}	10.204.87.179	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-07-20 03:14:35.466839
11	1	update	clergy	15	James Marshall	{"rank": "Priest", "organization": "Roman Catholic Institute", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": 3, "consecrator_id": null, "co_consecrators": []}	10.204.96.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-07-20 03:14:44.902713
12	1	update	clergy	14	Aedan Gilchrist	{"rank": "Priest", "organization": "Roman Catholic Institute", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": 2, "consecrator_id": null, "co_consecrators": []}	10.204.184.207	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-07-20 03:15:24.441867
13	1	update	clergy	2	Joseph S. Selway	{"rank": "Bishop", "organization": "Roman Catholic Institute", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": 17, "consecrator_id": 1, "co_consecrators": []}	10.204.184.207	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-07-20 03:15:47.231823
14	1	update	clergy	8	Damien Dutertre	{"rank": "Priest", "organization": "Roman Catholic Institute", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": 1, "consecrator_id": null, "co_consecrators": []}	10.204.89.93	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-07-20 03:16:02.809066
15	1	update	clergy	11	Michael DeSaye	{"rank": "Priest", "organization": "Roman Catholic Institute", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": 1, "consecrator_id": null, "co_consecrators": []}	10.204.145.29	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-07-20 03:16:26.241801
16	1	update	clergy	12	Tobias Bayer	{"rank": "Priest", "organization": "Roman Catholic Institute", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": 1, "consecrator_id": null, "co_consecrators": []}	10.204.9.242	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-07-20 03:17:39.532782
17	1	update	clergy	10	Henry de La Chanonie	{"rank": "Priest", "organization": "Roman Catholic Institute", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": 1, "consecrator_id": null, "co_consecrators": []}	10.204.184.207	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-07-20 03:17:50.871804
18	1	update	clergy	9	Luke Petrizzi	{"rank": "Priest", "organization": "Roman Catholic Institute", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": 1, "consecrator_id": null, "co_consecrators": []}	10.204.96.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-07-20 03:18:06.763048
19	1	update	clergy	4	Nicolás E. Despósito	{"rank": "Priest", "organization": "Roman Catholic Institute", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": 1, "consecrator_id": null, "co_consecrators": []}	10.204.96.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-07-20 03:18:18.360671
20	1	create	comment	1	Comment on Federico Palma	{"clergy_id": 5, "clergy_name": "Federico Palma", "content": "Ordained by Bp. Dolan?", "field_name": "ordaining_bishop_id", "is_public": true}	10.204.89.93	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-07-20 03:18:40.035652
21	1	create	clergy	19	Robert L. Neville	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": "1996-06-22", "date_of_consecration": "2005-04-28", "date_of_death": null}	10.204.89.93	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-07-20 03:33:56.538675
22	1	update	clergy	17	Robert Fidelis McKenna, O.P.	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": null, "co_consecrators": []}	10.204.96.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-07-21 13:58:10.407111
23	1	create	clergy	21	Franco Munari	{"rank": "Bishop", "organization": "", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1987-11-25", "date_of_death": null}	10.204.19.148	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-07-21 19:30:43.635594
24	1	create	organization	3	Institute of the Mother of Good Counsel	{"name": "Institute of the Mother of Good Counsel", "abbreviation": "IMBC", "description": "", "color": "#0aadff"}	10.204.36.204	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-07-21 19:32:34.713805
25	1	update	clergy	21	Franco Munari	{"rank": "Bishop", "organization": "Institute of the Mother of Good Counsel", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1987-11-25", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 20, "co_consecrators": []}	10.204.2.242	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-07-21 19:35:45.360377
26	1	update	clergy	17	Robert Fidelis McKenna, O.P.	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 20, "co_consecrators": []}	10.204.118.37	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-07-21 19:36:22.606038
27	1	login	user	1	admin	{"login_method": "password"}	10.204.145.29	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-07-22 03:28:24.786721
28	1	generate_invite	admin_invite	2	User invite for 53ea1d56...	{"token": "53ea1d56-1515-4cfd-88a2-73d0c2a95149", "expires_at": "2025-07-23T03:29:01.281462", "invited_by": 1, "role_id": "6", "role_name": "Admin", "expires_in_hours": 24, "max_uses": 1}	10.204.32.63	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-07-22 03:29:01.29561
29	2	create	user	2	andreas.ripensis	{"username": "andreas.ripensis", "role": "Admin", "invited_by": 1, "invite_token": "53ea1d56-1515-4cfd-88a2-73d0c2a95149"}	10.204.89.93	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:140.0) Gecko/20100101 Firefox/140.0	2025-07-22 03:37:08.812338
30	2	login	user	2	andreas.ripensis	{"login_method": "password"}	10.204.145.29	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:140.0) Gecko/20100101 Firefox/140.0	2025-07-22 03:37:20.693997
31	1	update	clergy	18	Richard Williamson	{"rank": "Bishop", "organization": "", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": 16, "consecrator_id": 16, "co_consecrators": []}	10.204.96.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-07-22 03:48:10.486595
32	1	create	clergy	22	Pierre Martin Ngô Đình Thục	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1938-05-04", "date_of_death": null}	10.204.145.29	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-07-23 22:35:53.859106
33	1	create	clergy	23	Michel Louis Guérard des Lauriers, O.P.	{"rank": "Bishop", "organization": "", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1984-05-30", "date_of_death": null}	10.204.89.93	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-07-23 22:37:03.035282
34	1	update	clergy	17	Robert Fidelis McKenna, O.P.	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 23, "co_consecrators": []}	10.204.32.63	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-07-23 22:37:30.350826
35	1	update	clergy	21	Franco Munari	{"rank": "Bishop", "organization": "Institute of the Mother of Good Counsel", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1987-11-25", "date_of_death": null, "ordaining_bishop_id": 23, "consecrator_id": 20, "co_consecrators": []}	10.204.9.242	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-07-23 22:38:31.765189
36	1	update	clergy	21	Franco Munari	{"rank": "Bishop", "organization": "Institute of the Mother of Good Counsel", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1987-11-25", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 23, "co_consecrators": []}	10.204.220.3	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-07-23 22:39:06.69509
37	1	login	user	1	admin	{"login_method": "password"}	10.204.174.107	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-27 21:16:48.582286
38	1	update	clergy	1	Donald J. Sanborn	{"rank": "Bishop", "organization": "Roman Catholic Institute", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "2002-06-19", "date_of_death": null, "ordaining_bishop_id": 16, "consecrator_id": 17, "co_consecrators": []}	10.204.190.114	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-27 21:17:28.352207
39	1	update	clergy	2	Joseph S. Selway	{"rank": "Bishop", "organization": "Roman Catholic Institute", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": 17, "consecrator_id": 1, "co_consecrators": []}	10.204.102.141	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-27 21:28:08.238788
40	1	update	clergy	3	Germán Fliess	{"rank": "Bishop", "organization": "Roman Catholic Institute", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": 1, "consecrator_id": 1, "co_consecrators": []}	10.204.30.52	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-27 21:30:31.213626
42	1	update	clergy	15	James Marshall	{"rank": "Priest", "organization": "Roman Catholic Institute", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": 3, "consecrator_id": null, "co_consecrators": []}	10.204.246.129	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-27 21:33:07.398531
43	1	update	clergy	7	Philip A. Eldracher	{"rank": "Priest", "organization": "Roman Catholic Institute", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": 1, "consecrator_id": null, "co_consecrators": []}	10.204.187.8	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-27 21:34:03.334672
45	1	update	clergy	8	Damien Dutertre	{"rank": "Priest", "organization": "Roman Catholic Institute", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": 1, "consecrator_id": null, "co_consecrators": []}	10.204.0.37	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-27 21:36:35.178571
46	1	update	clergy	14	Aedan Gilchrist	{"rank": "Priest", "organization": "Roman Catholic Institute", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": 2, "consecrator_id": null, "co_consecrators": []}	10.204.223.172	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-27 21:37:06.343481
47	1	update	clergy	10	Henry de La Chanonie	{"rank": "Priest", "organization": "Roman Catholic Institute", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": 1, "consecrator_id": null, "co_consecrators": []}	10.204.223.172	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-27 21:37:34.358076
51	1	update	clergy	17	Robert Fidelis McKenna, O.P.	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 23, "co_consecrators": []}	10.204.186.24	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-27 21:51:50.394792
41	1	update	clergy	6	Ojciec Rafal Trytek	{"rank": "Priest", "organization": "Roman Catholic Institute", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": null, "co_consecrators": []}	10.204.70.119	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-27 21:30:53.416949
44	1	update	clergy	13	Gregory Barnes	{"rank": "Priest", "organization": "Roman Catholic Institute", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": 1, "consecrator_id": null, "co_consecrators": []}	10.204.163.65	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-27 21:34:34.063507
48	1	update	clergy	4	Nicolás E. Despósito	{"rank": "Priest", "organization": "Roman Catholic Institute", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": 1, "consecrator_id": null, "co_consecrators": []}	10.204.218.158	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-27 21:38:00.165479
49	1	update	clergy	11	Michael DeSaye	{"rank": "Priest", "organization": "Roman Catholic Institute", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": 1, "consecrator_id": null, "co_consecrators": []}	10.204.174.107	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-27 21:38:35.349684
50	1	update	clergy	11	Michael DeSaye	{"rank": "Priest", "organization": "Roman Catholic Institute", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": 1, "consecrator_id": null, "co_consecrators": []}	10.204.0.37	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-27 21:38:53.864814
52	1	update	clergy	20	Guérard des Lauriers, O.P.	{"rank": "Bishop", "organization": "", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": null, "co_consecrators": []}	10.204.163.65	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-27 21:52:49.540034
53	1	update	clergy	20	Guérard des Lauriers, O.P.	{"rank": "Bishop", "organization": "", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": null, "co_consecrators": []}	10.204.186.24	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-27 21:53:17.807719
54	1	update	clergy	19	Robert L. Neville	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": "1996-06-22", "date_of_consecration": "2005-04-28", "date_of_death": null, "ordaining_bishop_id": 18, "consecrator_id": 17, "co_consecrators": []}	10.204.223.172	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-27 21:54:35.031422
55	1	update	clergy	20	Guérard des Lauriers, O.P.	{"rank": "Bishop", "organization": "", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": null, "co_consecrators": []}	10.204.223.172	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-27 21:54:51.735142
56	1	update	clergy	16	Marcel Lefebvre	{"rank": "Bishop", "organization": "", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": null, "co_consecrators": []}	10.204.186.24	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-27 21:57:15.543451
57	1	update	clergy	18	Richard Williamson	{"rank": "Bishop", "organization": "", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": 16, "consecrator_id": 16, "co_consecrators": []}	10.204.252.215	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-27 21:59:19.335895
58	1	update	clergy	20	Guérard des Lauriers, O.P.	{"rank": "Bishop", "organization": "", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": null, "co_consecrators": []}	10.204.246.129	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-27 22:00:18.136627
59	1	update	clergy	20	Guérard des Lauriers, O.P.	{"rank": "Bishop", "organization": "", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": null, "co_consecrators": []}	10.204.186.24	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-27 22:00:39.137485
60	1	update	clergy	20	Guérard des Lauriers, O.P.	{"rank": "Bishop", "organization": "", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": null, "co_consecrators": []}	10.204.70.119	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-27 22:01:28.706407
61	1	update	clergy	20	Guérard des Lauriers, O.P.	{"rank": "Bishop", "organization": "", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": null, "co_consecrators": []}	10.204.246.129	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-27 22:01:48.141517
62	1	update	clergy	22	Pierre Martin Ngô Đình Thục	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1938-05-04", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": null, "co_consecrators": []}	10.204.246.129	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-27 22:03:15.73071
63	1	update	clergy	23	Michel Louis Guérard des Lauriers, O.P.	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1984-05-30", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 22, "co_consecrators": []}	10.204.70.119	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-27 22:03:56.910037
102	1	create	clergy	37	Luigi Boni	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1982-04-18", "date_of_death": null}	10.204.177.160	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-14 19:19:20.698068
64	1	update	clergy	12	Tobias Bayer	{"rank": "Priest", "organization": "Roman Catholic Institute", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": 1, "consecrator_id": null, "co_consecrators": []}	10.204.246.129	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-27 22:04:42.398345
65	1	update	clergy	9	Luke Petrizzi	{"rank": "Priest", "organization": "Roman Catholic Institute", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": 1, "consecrator_id": null, "co_consecrators": []}	10.204.0.37	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-27 22:05:17.523978
66	1	update	clergy	23	Michel Louis Guérard des Lauriers, O.P.	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1984-05-30", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 22, "co_consecrators": []}	10.204.87.248	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-27 22:06:13.844585
67	1	update	clergy	5	Federico Palma	{"rank": "Priest", "organization": "Roman Catholic Institute", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": null, "co_consecrators": []}	10.204.186.24	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-27 22:08:47.016346
68	1	login	user	1	admin	{"login_method": "password"}	10.204.186.24	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-28 02:41:13.907602
69	1	update	clergy	20	Guérard des Lauriers, O.P.	{"rank": "Bishop", "organization": "", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": null, "co_consecrators": [], "is_deleted": true, "deleted_at": "2025-08-28T07:24:33.467531"}	10.204.218.158	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-28 07:24:33.480615
70	1	update	clergy	20	Guérard des Lauriers, O.P.	{"rank": "Bishop", "organization": "", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": null, "co_consecrators": [], "is_deleted": true, "deleted_at": "2025-08-28T07:24:33.472861"}	10.204.223.172	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-28 07:24:33.486494
71	1	update	clergy	16	Marcel Lefebvre	{"rank": "Bishop", "organization": "Society of St. Pius X", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": null, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.166.78	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-28 13:27:36.777642
72	1	update	clergy	16	Marcel Lefebvre	{"rank": "Bishop", "organization": "Society of St. Pius X", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": null, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.252.215	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-28 13:27:36.83842
73	1	update	clergy	18	Richard Williamson	{"rank": "Bishop", "organization": "Resistance", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": 16, "consecrator_id": 16, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.223.172	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-28 13:28:50.803079
74	1	update	clergy	18	Richard Williamson	{"rank": "Bishop", "organization": "Resistance", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": 16, "consecrator_id": 16, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.186.24	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-28 13:28:50.828421
75	1	create	clergy	24	Moisés Carmona y Rivera	{"rank": "Bishop", "organization": "", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1981-10-17", "date_of_death": null}	10.204.218.158	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-28 13:33:58.823839
76	1	update	clergy	24	Moisés Carmona y Rivera	{"rank": "Bishop", "organization": "", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1981-10-17", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 22, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.70.119	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-28 13:35:13.83189
77	1	update	clergy	24	Moisés Carmona y Rivera	{"rank": "Bishop", "organization": "", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1981-10-17", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 22, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.223.172	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-28 13:35:13.84396
78	1	create	clergy	25	Mark Anthony Pivarunas	{"rank": "Bishop", "organization": "", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1991-09-24", "date_of_death": null}	10.204.102.141	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-28 13:56:58.929507
79	1	update	clergy	25	Mark Anthony Pivarunas	{"rank": "Bishop", "organization": "", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1991-09-24", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 24, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.102.141	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-28 13:59:19.044114
80	1	update	clergy	25	Mark Anthony Pivarunas	{"rank": "Bishop", "organization": "", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1991-09-24", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 24, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.102.141	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-28 13:59:19.141892
81	1	update	clergy	25	Mark Anthony Pivarunas	{"rank": "Bishop", "organization": "Congregation of Mary Immaculate Queen", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1991-09-24", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 24, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.166.78	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-28 14:00:26.826672
82	1	update	clergy	25	Mark Anthony Pivarunas	{"rank": "Bishop", "organization": "Congregation of Mary Immaculate Queen", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1991-09-24", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 24, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.218.158	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-28 14:00:26.836377
83	1	create	clergy	26	George Musey	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1982-04-01", "date_of_death": null}	10.204.223.172	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-28 14:02:38.63768
211	1	login	user	1	admin	{"login_method": "password"}	10.204.1.155	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-19 22:25:46.708682
84	1	update	clergy	24	Moisés Carmona y Rivera	{"rank": "Bishop", "organization": "", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1981-10-17", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 22, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.70.119	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-28 14:02:48.482689
85	1	update	clergy	24	Moisés Carmona y Rivera	{"rank": "Bishop", "organization": "", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1981-10-17", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 22, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.70.119	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-28 14:02:48.489082
86	1	create	clergy	27	Louis Vezelis, OFM	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1982-08-24", "date_of_death": null}	10.204.70.119	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-28 14:06:22.56117
87	1	update	clergy	27	Louis Vezelis, OFM	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1982-08-24", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 26, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.102.141	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-28 14:06:49.845486
88	1	update	clergy	27	Louis Vezelis, OFM	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1982-08-24", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 26, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.102.141	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-28 14:06:49.93957
89	1	update	clergy	27	Louis Vezelis, OFM	{"rank": "Bishop", "organization": "Independent", "date_of_birth": "1930-01-29", "date_of_ordination": null, "date_of_consecration": "1982-08-24", "date_of_death": "2013-10-10", "ordaining_bishop_id": null, "consecrator_id": 26, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.86.187	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-28 14:09:17.42702
90	1	update	clergy	27	Louis Vezelis, OFM	{"rank": "Bishop", "organization": "Independent", "date_of_birth": "1930-01-29", "date_of_ordination": null, "date_of_consecration": "1982-08-24", "date_of_death": "2013-10-10", "ordaining_bishop_id": null, "consecrator_id": 26, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.0.37	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-28 14:09:17.431474
91	1	update	clergy	29	Raymond Maurice Terrasson	{"rank": "Bishop", "organization": "Palmarian", "date_of_birth": null, "date_of_ordination": "1974-12-23", "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": 28, "consecrator_id": null, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.220.140	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-09-02 11:27:52.545281
92	1	update	clergy	29	Raymond Maurice Terrasson	{"rank": "Bishop", "organization": "Palmarian", "date_of_birth": null, "date_of_ordination": "1974-12-23", "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": 28, "consecrator_id": null, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.230.204	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-09-02 11:27:52.547245
93	1	update	clergy	30	Timothy Hennebery	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": "1990-10-17", "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": 24, "consecrator_id": null, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.12.102	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-09-02 11:29:03.734172
94	1	update	clergy	30	Timothy Hennebery	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": "1990-10-17", "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": 24, "consecrator_id": null, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.120.18	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-09-02 11:29:03.735991
95	1	update	clergy	31	Clemente Ferdinand Domingez Gómez 	{"rank": "Bishop", "organization": "Palmarian", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": null, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.201.50	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-09-02 11:36:50.042056
96	1	update	clergy	31	Clemente Ferdinand Domingez Gómez 	{"rank": "Bishop", "organization": "Palmarian", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": null, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.201.50	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-09-02 11:36:51.53272
97	1	login	user	1	admin	{"login_method": "password"}	10.204.235.112	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-14 17:05:00.640297
98	1	create	clergy	34	Francis B. Sandler, O.S.B.	{"rank": "Bishop", "organization": "Palmarian", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1975-12-01", "date_of_death": null}	10.204.238.133	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-14 19:13:35.190023
99	1	create	clergy	35	Adolfo Zamora Hernandez	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1981-10-17", "date_of_death": null}	10.204.96.113	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-14 19:16:22.821417
100	1	update	clergy	23	Michel Louis Guérard des Lauriers, O.P.	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1981-05-07", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 22, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.96.113	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-14 19:17:15.760237
101	1	create	clergy	36	Christian Datessen	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1982-09-25", "date_of_death": null}	10.204.48.3	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-14 19:18:30.704104
103	1	create	clergy	38	Claude Nanta de Torrini	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1977-03-19", "date_of_death": null}	10.204.20.232	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-14 19:20:51.78812
104	1	update	clergy	24	Moisés Carmona y Rivera	{"rank": "Bishop", "organization": "Society of Trento, Mexico", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1981-10-17", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 22, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.212.11	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-14 19:25:08.355631
105	1	update	clergy	35	Adolfo Zamora Hernandez	{"rank": "Bishop", "organization": "Society of Trento, Mexico", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1981-10-17", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 22, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.212.11	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-14 19:25:25.968148
106	1	create	clergy	39	Benigno Bravo Valades	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1982-06-18", "date_of_death": null}	10.204.96.113	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-14 19:26:45.129808
107	1	create	clergy	40	Roberto Martinez	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1982-06-18", "date_of_death": null}	10.204.235.112	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-14 19:28:37.550958
108	1	create	clergy	41	Santiago de la Cuz Corona	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1990-02-18", "date_of_death": null}	10.204.96.113	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-14 19:29:34.455799
109	1	create	clergy	42	Peter Hillebrand	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1991-07-17", "date_of_death": null}	10.204.235.112	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-14 19:30:39.945793
110	1	update	clergy	31	Clemente Ferdinand Domingez Gómez 	{"rank": "Bishop", "organization": "Palmarian", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1975-12-01", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 22, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.167.203	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-14 19:31:56.929569
111	1	create	clergy	43	Daniel Lytle Dolan	{"rank": "Bishop", "organization": "", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1993-11-30", "date_of_death": null}	10.204.126.58	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-14 19:33:34.087685
112	1	create	clergy	44	Martin Davila Gandara	{"rank": "Bishop", "organization": "Society of Trento, Mexico", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1999-05-11", "date_of_death": null}	10.204.96.113	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-14 19:35:48.477253
113	1	update	clergy	43	Daniel Lytle Dolan	{"rank": "Bishop", "organization": "Saint Gertrude the Great", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1993-11-30", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 25, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.223.188	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-14 19:39:07.254084
114	1	update	clergy	43	Daniel Lytle Dolan	{"rank": "Bishop", "organization": "Saint Gertrude the Great", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1993-11-30", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 25, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.238.133	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-14 19:42:06.19231
115	1	update	clergy	43	Daniel Lytle Dolan	{"rank": "Bishop", "organization": "Saint Gertrude the Great", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1993-11-30", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 25, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.77.210	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-14 19:42:06.274069
116	1	create	clergy	45	Ralph Siebert	{"rank": "Bishop", "organization": "", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1982-05-24", "date_of_death": null}	10.204.177.160	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-14 19:45:26.548589
117	1	create	clergy	46	Conrad Altenbach	{"rank": "Bishop", "organization": "", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1984-05-24", "date_of_death": null}	10.204.238.133	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-14 19:46:03.214253
118	1	create	clergy	47	Philippe Miguet	{"rank": "Bishop", "organization": "", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1987-12-02", "date_of_death": null}	10.204.126.58	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-14 19:46:42.637556
119	1	create	clergy	48	Giles Butler, O.F.M.	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "2005-08-24", "date_of_death": null}	10.204.167.203	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-14 19:47:44.846675
120	1	create	clergy	49	Luis Alberto Madrigal	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "2007-12-12", "date_of_death": null}	10.204.238.133	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-14 19:48:15.611024
121	1	create	clergy	50	Bonaventure Strandt	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "2012-08-15", "date_of_death": null}	10.204.170.163	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-14 19:49:09.916167
122	1	create	clergy	51	Gunther Stork	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1984-04-30", "date_of_death": null}	10.204.238.133	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-14 19:51:06.304338
123	1	create	clergy	52	J. Elmer Vida	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1987-07-02", "date_of_death": null}	10.204.238.133	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-14 19:51:46.76507
124	1	create	clergy	53	Richard F. Bedignfeld	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1987-12-17", "date_of_death": null}	10.204.177.160	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-14 19:52:23.369685
125	1	create	clergy	54	Francis Słupski, C.S.S.R.	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": "1961-08-27", "date_of_consecration": "1999-10-12", "date_of_death": null}	10.204.223.188	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-14 19:53:35.391993
126	1	create	clergy	55	Oliver Oravec, S.J.	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1988-10-21", "date_of_death": null}	10.204.77.210	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-14 19:54:40.307214
127	1	create	clergy	56	Geert Jan Stuyver	{"rank": "Bishop", "organization": "Institute of the Mother of Good Counsel", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "2002-01-16", "date_of_death": null}	10.204.177.160	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-14 19:55:34.249965
128	1	create	clergy	57	Andrès Morello	{"rank": "Bishop", "organization": "", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "2006-11-30", "date_of_death": null}	10.204.77.210	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-14 19:56:41.144788
129	1	create	clergy	58	John E. Hesson	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1991-06-12", "date_of_death": null}	10.204.235.112	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-14 19:57:38.848984
130	1	create	clergy	59	Raphaël Cloquell	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1996-10-24", "date_of_death": null}	10.204.238.133	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-14 19:58:41.725012
131	1	create	clergy	60	José A. Rodriquez López	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null}	10.204.235.112	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-14 19:59:37.505311
132	1	create	clergy	61	Ryan St. Anne Scott	{"rank": "Bishop", "organization": "", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1999-05-20", "date_of_death": null}	10.204.96.113	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 00:20:31.941975
133	1	create	clergy	62	Dennis McCormack	{"rank": "Bishop", "organization": "", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "2007-10-01", "date_of_death": null}	10.204.48.3	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 00:24:31.450384
134	1	create	clergy	63	Neal R. Webster	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "2007-11-15", "date_of_death": null}	10.204.177.160	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 00:26:07.009649
135	1	create	clergy	64	Paul S. Petko	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "2011-03-11", "date_of_death": null}	10.204.77.210	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 00:29:27.220072
136	1	create	clergy	65	Anton Thai Trinh	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "2011-10-24", "date_of_death": null}	10.204.170.163	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 00:56:15.246231
137	1	create	clergy	66	Robert Dymek	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "2011-12-27", "date_of_death": null}	10.204.126.58	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 00:56:49.216942
138	1	create	clergy	67	Markus Ramolla	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "2012-05-23", "date_of_death": null}	10.204.48.3	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 01:05:35.825828
139	1	create	clergy	68	Edward Peterson	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1994-07-29", "date_of_death": null}	10.204.96.113	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 01:09:07.857973
140	1	update	clergy	53	Richard F. Bedingfeld	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1987-12-17", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 17, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.223.188	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 01:09:27.723027
141	1	create	clergy	69	Philippe Cochonneaud	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1998-11-08", "date_of_death": null}	10.204.48.3	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 01:10:21.572308
142	1	create	clergy	70	Victor von Pentz	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1998-11-07", "date_of_death": null}	10.204.126.58	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 01:13:25.457341
143	1	create	clergy	71	Emmanuel Koráb	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null}	10.204.126.58	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 01:14:14.854909
144	1	create	clergy	72	Pavol Maria Hnilica, S.J.	{"rank": "Bishop", "organization": "", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1951-01-01", "date_of_death": null}	10.204.177.160	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 01:18:11.792839
145	1	create	clergy	73	Pavol Maria Hnilica, S.J.	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1951-01-01", "date_of_death": null}	10.204.77.210	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 01:21:14.567712
146	1	update	clergy	71	Emmanuel Koráb	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": "1998-11-03", "date_of_consecration": "1998-11-04", "date_of_death": null, "ordaining_bishop_id": 72, "consecrator_id": 73, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.167.203	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 01:22:19.950851
147	1	create	clergy	74	Michael French	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "2004-10-16", "date_of_death": null}	10.204.96.113	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 01:26:28.546548
148	1	create	clergy	75	Simon Scharf	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "2018-08-04", "date_of_death": null}	10.204.96.113	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 01:28:48.471706
149	1	create	clergy	76	Clarence Kelly	{"rank": "Bishop", "organization": "Society of St. Pius X", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1993-10-19", "date_of_death": null}	10.204.223.188	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 01:33:08.364442
150	1	update	clergy	76	Clarence Kelly	{"rank": "Bishop", "organization": "Congregation of St. Pius V", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1993-10-19", "date_of_death": null, "ordaining_bishop_id": 16, "consecrator_id": 77, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.223.188	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 01:35:36.913128
151	1	create	clergy	78	Joseph Santay	{"rank": "Bishop", "organization": "Congregation of St. Pius V", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "2007-02-28", "date_of_death": null}	10.204.20.232	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 01:37:21.838326
152	1	create	clergy	79	James Carroll	{"rank": "Bishop", "organization": "Congregation of St. Pius V", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "2018-12-27", "date_of_death": null}	10.204.167.203	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 01:39:40.184825
153	1	update	clergy	77	Alfredo José Isaac Cecilio Francesco Méndez Gonzalez, C.S.C.	{"rank": "Bishop", "organization": "Pre Vatican II", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": null, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.167.203	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 01:40:31.073937
154	1	update	clergy	18	Richard Williamson	{"rank": "Bishop", "organization": "Resistance", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1988-06-30", "date_of_death": null, "ordaining_bishop_id": 16, "consecrator_id": 16, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.96.113	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 01:43:03.278694
155	1	create	clergy	80	Bernard Fellay	{"rank": "Bishop", "organization": "Society of St. Pius X", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1988-06-30", "date_of_death": null}	10.204.20.232	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 01:43:34.273567
156	1	create	clergy	81	Alphonso de Galarreta	{"rank": "Bishop", "organization": "Society of St. Pius X", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1988-06-30", "date_of_death": null}	10.204.223.188	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 01:44:35.431937
157	1	create	clergy	82	Bernard Tissier de Mallerais	{"rank": "Bishop", "organization": "Society of St. Pius X", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1988-06-30", "date_of_death": null}	10.204.96.113	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 01:46:38.748332
158	1	create	clergy	83	Licinio Rangel	{"rank": "Bishop", "organization": "Periestly Union of St. Jean-Marie Vianney", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1991-07-28", "date_of_death": null}	10.204.167.203	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 01:50:33.942023
159	1	create	clergy	84	Jean-Michel Faure	{"rank": "Bishop", "organization": "Union Sacerdotale Marcel Lefebvre", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "2015-03-19", "date_of_death": null}	10.204.96.113	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 01:52:25.037032
160	1	create	clergy	85	Miguel Ferreira da Costa	{"rank": "Bishop", "organization": "Union Sacerdotale Marcel Lefebvre", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "2016-03-19", "date_of_death": null}	10.204.177.160	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 01:53:26.686764
161	1	create	clergy	86	Gerardo Zendejas	{"rank": "Bishop", "organization": "Union Sacerdotale Marcel Lefebvre", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "2017-05-12", "date_of_death": null}	10.204.126.58	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 01:54:54.867567
162	1	create	clergy	87	António de Castro Mayer	{"rank": "Bishop", "organization": "Pre Vatican II", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null}	10.204.223.188	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 01:57:31.758703
163	1	create	clergy	88	Fernando Areas Rifan	{"rank": "Bishop", "organization": "Periestly Union of St. Jean-Marie Vianney", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "2002-08-18", "date_of_death": null}	10.204.167.203	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 02:01:15.882177
164	1	create	clergy	89	Darío Castrillón Hoyos	{"rank": "Bishop", "organization": "", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null}	10.204.48.3	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 02:02:02.824339
165	1	update	clergy	89	Darío Castrillón Hoyos	{"rank": "Bishop", "organization": "", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": null, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.48.3	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 02:02:55.652356
166	1	update	clergy	73	Pavol Maria Hnilica, S.J.	{"rank": "Bishop", "organization": "Pre Vatican II", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1951-01-01", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": null, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.137.228	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 12:21:50.519169
167	1	update	clergy	73	Pavol Maria Hnilica, S.J.	{"rank": "Bishop", "organization": "Pre Vatican II", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1951-01-01", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": null, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.20.232	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 12:22:08.159791
168	1	update	clergy	22	Pierre Martin Ngô Đình Thục	{"rank": "Bishop", "organization": "Pre Vatican II", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1938-05-04", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": null, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.108.165	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 12:22:39.014553
169	1	update	clergy	83	Licinio Rangel	{"rank": "Bishop", "organization": "Priestly Union of St. Jean-Marie Vianney", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1991-07-28", "date_of_death": null, "ordaining_bishop_id": 87, "consecrator_id": 82, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.167.203	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 12:24:43.948427
170	1	update	clergy	88	Fernando Areas Rifan	{"rank": "Bishop", "organization": "Priestly Union of St. Jean-Marie Vianney", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "2002-08-18", "date_of_death": null, "ordaining_bishop_id": 87, "consecrator_id": 89, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.80.96	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 12:25:07.601335
171	1	update	clergy	89	Darío Castrillón Hoyos	{"rank": "Bishop", "organization": "Post Vatican II", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": null, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.80.96	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 12:27:36.903131
172	1	update	clergy	48	Giles Butler, O.F.M.	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "2005-08-24", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 27, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.92.151	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 13:28:59.503951
173	1	update	clergy	48	Giles Butler, O.F.M.	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "2005-08-24", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 27, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.177.160	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 13:28:59.869933
174	1	update	clergy	48	Giles Butler, O.F.M.	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "2005-08-24", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 27, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.53.229	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 13:29:01.841115
175	1	update	clergy	54	Francis Słupski, C.S.S.R.	{"rank": "Bishop", "organization": "Independent", "date_of_birth": "1935-05-30", "date_of_ordination": "1961-08-27", "date_of_consecration": "1999-10-12", "date_of_death": "2018-05-14", "ordaining_bishop_id": null, "consecrator_id": 17, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.53.229	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 13:34:50.84664
176	1	update	clergy	54	Francis Słupski, C.S.S.R.	{"rank": "Bishop", "organization": "Independent", "date_of_birth": "1935-05-30", "date_of_ordination": "1961-08-27", "date_of_consecration": "1999-10-12", "date_of_death": "2018-05-14", "ordaining_bishop_id": null, "consecrator_id": 17, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.255.129	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 13:34:51.2421
177	1	update	clergy	55	Oliver Oravec, S.J.	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1988-10-21", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 17, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.183.122	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 13:38:24.835666
178	1	update	clergy	55	Oliver Oravec, S.J.	{"rank": "Bishop", "organization": "Independent", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1988-10-21", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 17, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.80.96	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 13:38:25.047402
179	1	update	clergy	76	Clarence Kelly	{"rank": "Bishop", "organization": "Congregation of St. Pius V", "date_of_birth": null, "date_of_ordination": "1973-04-14", "date_of_consecration": "1993-10-19", "date_of_death": "2023-12-02", "ordaining_bishop_id": 16, "consecrator_id": 77, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.48.3	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 13:43:57.23441
180	1	update	clergy	76	Clarence Kelly	{"rank": "Bishop", "organization": "Congregation of St. Pius V", "date_of_birth": null, "date_of_ordination": "1973-04-14", "date_of_consecration": "1993-10-19", "date_of_death": "2023-12-02", "ordaining_bishop_id": 16, "consecrator_id": 77, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.48.3	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 13:43:57.835163
181	1	create	clergy	90	Francis Spellman	{"rank": "Bishop", "organization": "Pre Vatican II", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1932-09-08", "date_of_death": null}	10.204.20.232	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 13:48:06.299119
182	1	create	clergy	91	Pope Pius XII	{"rank": "Bishop", "organization": "Pre Vatican II", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null}	10.204.206.242	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 13:49:43.132488
183	1	create	clergy	92	Pope Benedict XV	{"rank": "Bishop", "organization": "Pre Vatican II", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null}	10.204.255.129	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 13:50:47.28744
184	1	create	clergy	93	Pope Pius X	{"rank": "Bishop", "organization": "Pre Vatican II", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null}	10.204.255.129	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 13:51:13.75533
185	1	update	clergy	77	Alfredo José Isaac Cecilio Francesco Méndez Gonzalez, C.S.C.	{"rank": "Bishop", "organization": "Pre Vatican II", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1960-10-28", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 90, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.134.39	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 13:52:52.678561
186	1	update	clergy	91	Pope Pius XII	{"rank": "Bishop", "organization": "Pre Vatican II", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1917-05-13", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 92, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.137.228	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 13:53:50.09231
187	1	update	clergy	92	Pope Benedict XV	{"rank": "Bishop", "organization": "Pre Vatican II", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1907-12-22", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 93, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.215.158	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 13:54:48.833724
188	1	update	clergy	22	Pierre Martin Ngô Đình Thục	{"rank": "Archbishop", "organization": "Pre Vatican II", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": null, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.147.183	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 14:25:02.901713
189	1	update	clergy	93	Pope Pius X	{"rank": "Pope", "organization": "Pre Vatican II", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": null, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.167.203	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 14:25:24.23622
190	1	update	clergy	93	Giuseppe Melchiorre Sarto	{"rank": "Pope", "organization": "Pre Vatican II", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": null, "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": null, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.147.183	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 18:42:37.937308
191	1	update	clergy	92	Giacomo Della Chiesa	{"rank": "Pope", "organization": "Pre Vatican II", "date_of_birth": "1854-11-21", "date_of_ordination": null, "date_of_consecration": "1907-12-22", "date_of_death": "1922-01-22", "ordaining_bishop_id": null, "consecrator_id": 93, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.170.163	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 18:45:50.767716
192	1	update	clergy	92	Giacomo Della Chiesa	{"rank": "Pope", "organization": "Pre Vatican II", "date_of_birth": "1854-11-21", "date_of_ordination": null, "date_of_consecration": "1907-12-22", "date_of_death": "1922-01-22", "ordaining_bishop_id": null, "consecrator_id": 93, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.147.183	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 20:16:03.55095
193	1	update	clergy	91	Pope Pius XII	{"rank": "Bishop", "organization": "Pre Vatican II", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1917-05-13", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 92, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.126.58	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 20:17:20.189197
194	1	update	clergy	91	Pope Pius XII	{"rank": "Bishop", "organization": "Pre Vatican II", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1917-05-13", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 92, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.48.3	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 20:18:15.898533
195	1	update	clergy	90	Francis Spellman	{"rank": "Bishop", "organization": "Pre Vatican II", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1932-09-08", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 91, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.170.163	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 20:21:10.657386
196	1	update	clergy	91	Pope Pius XII	{"rank": "Bishop", "organization": "Pre Vatican II", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1917-05-13", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 92, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.48.3	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 20:22:26.540622
197	1	update	clergy	90	Francis Spellman	{"rank": "Bishop", "organization": "Pre Vatican II", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1932-09-08", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 91, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.108.165	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 20:22:51.032929
198	1	update	clergy	77	Alfredo José Isaac Cecilio Francesco Méndez Gonzalez, C.S.C.	{"rank": "Bishop", "organization": "Pre Vatican II", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1960-10-28", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 90, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.223.188	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 20:24:46.627312
199	1	update	clergy	91	Eugenio Maria Giuseppe Giovanni Pacelli	{"rank": "Pope", "organization": "Pre Vatican II", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1917-05-13", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 92, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.177.160	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 20:25:27.335018
200	1	update	clergy	90	Francis Spellman	{"rank": "Cardinal", "organization": "Pre Vatican II", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1932-09-08", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 91, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.223.188	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 20:25:38.638061
201	1	update	clergy	78	Joseph Santay	{"rank": "Bishop", "organization": "Congregation of St. Pius V", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "2007-02-28", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 76, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.20.232	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 20:26:57.161358
202	1	update	clergy	79	James Carroll	{"rank": "Bishop", "organization": "Congregation of St. Pius V", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "2018-12-27", "date_of_death": null, "ordaining_bishop_id": 78, "consecrator_id": 78, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.20.232	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 20:28:33.41942
203	1	update	clergy	80	Bernard Fellay	{"rank": "Bishop", "organization": "Society of St. Pius X", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1988-06-30", "date_of_death": null, "ordaining_bishop_id": 16, "consecrator_id": 16, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.255.129	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 20:30:47.854295
204	1	update	clergy	81	Alphonso de Galarreta	{"rank": "Bishop", "organization": "Society of St. Pius X", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1988-06-30", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 16, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.170.163	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 20:32:07.239425
205	1	update	clergy	86	Gerardo Zendejas	{"rank": "Bishop", "organization": "Union Sacerdotale Marcel Lefebvre", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "2017-05-12", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 18, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.96.113	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 20:33:30.747605
206	1	update	clergy	84	Jean-Michel Faure	{"rank": "Bishop", "organization": "Union Sacerdotale Marcel Lefebvre", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "2015-03-19", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 18, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.255.129	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 20:35:37.870539
207	1	update	clergy	57	Andrès Morello	{"rank": "Bishop", "organization": "", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "2006-11-30", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 19, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.177.160	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 20:38:30.766676
208	1	update	clergy	82	Bernard Tissier de Mallerais	{"rank": "Bishop", "organization": "Society of St. Pius X", "date_of_birth": null, "date_of_ordination": null, "date_of_consecration": "1988-06-30", "date_of_death": null, "ordaining_bishop_id": null, "consecrator_id": 16, "co_consecrators": [], "is_deleted": false, "deleted_at": null}	10.204.126.58	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 20:40:20.351373
209	1	login	user	1	admin	{"login_method": "password"}	10.204.223.188	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-17 15:48:49.097673
210	1	login	user	1	admin	{"login_method": "password"}	10.204.39.230	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-18 17:29:12.87843
\.


--
-- Data for Name: clergy; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.clergy (id, name, rank, organization, date_of_birth, date_of_ordination, ordaining_bishop_id, date_of_consecration, consecrator_id, co_consecrators, date_of_death, notes, image_url, image_data, is_deleted, deleted_at, papal_name) FROM stdin;
8	Damien Dutertre	Priest	Roman Catholic Institute	\N	\N	\N	\N	\N	\N	\N	Teaches Dogmatic Theology, Nantes, France	\N	\N	f	\N	\N
14	Aedan Gilchrist	Priest	Roman Catholic Institute	\N	\N	\N	\N	\N	\N	\N	Missions in British Isles, assists in Nantes, France	\N	\N	f	\N	\N
10	Henry de La Chanonie	Priest	Roman Catholic Institute	\N	\N	\N	\N	\N	\N	\N	Pastoral work in Nantes, France	\N	\N	f	\N	\N
4	Nicolás E. Despósito	Priest	Roman Catholic Institute	\N	\N	\N	\N	\N	\N	\N	Professor at Most Holy Trinity Seminary	\N	\N	f	\N	\N
11	Michael DeSaye	Priest	Roman Catholic Institute	\N	\N	\N	\N	\N	\N	\N	Associate at Queen of All Saints Chapel, Brooksville, FL	\N	\N	f	\N	\N
17	Robert Fidelis McKenna, O.P.	Bishop	Independent	\N	\N	\N	\N	\N	\N	\N		\N	\N	f	\N	\N
19	Robert L. Neville	Bishop	Independent	\N	1996-06-22	\N	2005-04-28	\N	\N	\N	Pastor of St. Dominic Chapel in Highland, Michgan.	\N	\N	f	\N	\N
57	Andrès Morello	Bishop		\N	\N	\N	2006-11-30	\N	\N	\N	\N	\N	\N	f	\N	\N
23	Michel Louis Guérard des Lauriers, O.P.	Bishop	Independent	\N	\N	\N	1981-05-07	\N	\N	\N	\N	\N	\N	f	\N	\N
25	Mark Anthony Pivarunas	Bishop	Congregation of Mary Immaculate Queen	\N	\N	\N	1991-09-24	\N	\N	\N		\N	\N	f	\N	\N
26	George Musey	Bishop	Independent	\N	\N	\N	1982-04-01	\N	\N	\N		\N	\N	f	\N	\N
36	Christian Datessen	Bishop	Independent	\N	\N	\N	1982-09-25	\N	\N	\N		\N	\N	f	\N	\N
27	Louis Vezelis, OFM	Bishop	Independent	1930-01-29	\N	\N	1982-08-24	\N	\N	2013-10-10		\N	\N	f	\N	\N
28	Jean Laborie	Bishop	Independent	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N
37	Luigi Boni	Bishop	Independent	\N	\N	\N	1982-04-18	\N	\N	\N		\N	\N	f	\N	\N
21	Franco Munari	Bishop	Institute of the Mother of Good Counsel	\N	\N	\N	1987-11-25	\N	\N	\N		\N	\N	f	\N	\N
1	Donald J. Sanborn	Bishop	Roman Catholic Institute	\N	\N	\N	2002-06-19	\N	\N	\N	Superior General, Rector of Most Holy Trinity Seminary	\N	\N	f	\N	\N
2	Joseph S. Selway	Bishop	Roman Catholic Institute	\N	\N	\N	\N	\N	\N	\N	Consecrated by Donald Sanborn on February 22, 2018	\N	\N	f	\N	\N
3	Germán Fliess	Bishop	Roman Catholic Institute	\N	\N	\N	\N	\N	\N	\N	Consecrated by Donald Sanborn in 2022	\N	\N	f	\N	\N
6	Ojciec Rafal Trytek	Priest	Roman Catholic Institute	\N	\N	\N	\N	\N	\N	\N	Krakow, Poland; joined RCI in 2017	\N	\N	f	\N	\N
15	James Marshall	Priest	Roman Catholic Institute	\N	\N	\N	\N	\N	\N	\N	Serves at Florida chapels, ordained by Bp. Fliess in 2024	\N	\N	f	\N	\N
7	Philip A. Eldracher	Priest	Roman Catholic Institute	\N	\N	\N	\N	\N	\N	\N	Assistant Pastor in Australia	\N	\N	f	\N	\N
13	Gregory Barnes	Priest	Roman Catholic Institute	\N	\N	\N	\N	\N	\N	\N	Teaches at Queen of All Saints Academy, assists at chapels in FL and AZ	\N	\N	f	\N	\N
48	Giles Butler, O.F.M.	Bishop	Independent	\N	\N	\N	2005-08-24	\N	\N	\N		\N	\N	f	\N	\N
38	Claude Nanta de Torrini	Bishop	Independent	\N	\N	\N	1977-03-19	\N	\N	\N		\N	\N	f	\N	\N
12	Tobias Bayer	Priest	Roman Catholic Institute	\N	\N	\N	\N	\N	\N	\N	Secretary to Bishop Sanborn	\N	\N	f	\N	\N
9	Luke Petrizzi	Priest	Roman Catholic Institute	\N	\N	\N	\N	\N	\N	\N	Teaches Church History and Latin at MHT Seminary	\N	\N	f	\N	\N
5	Federico Palma	Priest	Roman Catholic Institute	\N	\N	\N	\N	\N	\N	\N	Pastor of RCI chapels in Australia	\N	\N	f	\N	\N
20	Guérard des Lauriers, O.P.	Bishop		\N	\N	\N	\N	\N	\N	\N	None	\N	\N	t	2025-08-28 07:24:33.472861	\N
24	Moisés Carmona y Rivera	Bishop	Society of Trento, Mexico	\N	\N	\N	1981-10-17	\N	\N	\N	\N	\N	\N	f	\N	\N
16	Marcel Lefebvre	Bishop	Society of St. Pius X	\N	\N	\N	\N	\N	\N	\N	None	\N	\N	f	\N	\N
35	Adolfo Zamora Hernandez	Bishop	Society of Trento, Mexico	\N	\N	\N	1981-10-17	\N	\N	\N	\N	\N	\N	f	\N	\N
54	Francis Słupski, C.S.S.R.	Bishop	Independent	1935-05-30	1961-08-27	\N	1999-10-12	\N	\N	2018-05-14		\N	\N	f	\N	\N
30	Timothy Hennebery	Bishop	Independent	\N	1990-10-17	\N	\N	\N	\N	\N	None	\N	\N	f	\N	\N
29	Raymond Maurice Terrasson	Bishop	Palmarian	\N	1974-12-23	\N	\N	\N	\N	\N	None	\N	\N	f	\N	\N
44	Martin Davila Gandara	Bishop	Society of Trento, Mexico	\N	\N	\N	1999-05-11	\N	\N	\N		\N	\N	f	\N	\N
34	Francis B. Sandler, O.S.B.	Bishop	Palmarian	\N	\N	\N	1975-12-01	\N	\N	\N	Consecration is December of 1975, exact date not known.	\N	\N	f	\N	\N
39	Benigno Bravo Valades	Bishop	Independent	\N	\N	\N	1982-06-18	\N	\N	\N		\N	\N	f	\N	\N
40	Roberto Martinez	Bishop	Independent	\N	\N	\N	1982-06-18	\N	\N	\N		\N	\N	f	\N	\N
41	Santiago de la Cuz Corona	Bishop	Independent	\N	\N	\N	1990-02-18	\N	\N	\N		\N	\N	f	\N	\N
42	Peter Hillebrand	Bishop	Independent	\N	\N	\N	1991-07-17	\N	\N	\N		\N	\N	f	\N	\N
31	Clemente Ferdinand Domingez Gómez 	Bishop	Palmarian	\N	\N	\N	1975-12-01	\N	\N	\N	‘Pope Gregory XVII’, Founder of the Palmarian Church. Consecrated in December of 1975.	\N	\N	f	\N	\N
49	Luis Alberto Madrigal	Bishop	Independent	\N	\N	\N	2007-12-12	\N	\N	\N		\N	\N	f	\N	\N
43	Daniel Lytle Dolan	Bishop	Saint Gertrude the Great	\N	\N	\N	1993-11-30	\N	\N	\N	None	\N	\N	f	\N	\N
45	Ralph Siebert	Bishop		\N	\N	\N	1982-05-24	\N	\N	\N		\N	\N	f	\N	\N
46	Conrad Altenbach	Bishop		\N	\N	\N	1984-05-24	\N	\N	\N		\N	\N	f	\N	\N
47	Philippe Miguet	Bishop		\N	\N	\N	1987-12-02	\N	\N	\N		\N	\N	f	\N	\N
50	Bonaventure Strandt	Bishop	Independent	\N	\N	\N	2012-08-15	\N	\N	\N		\N	\N	f	\N	\N
51	Gunther Stork	Bishop	Independent	\N	\N	\N	1984-04-30	\N	\N	\N		\N	\N	f	\N	\N
52	J. Elmer Vida	Bishop	Independent	\N	\N	\N	1987-07-02	\N	\N	\N		\N	\N	f	\N	\N
18	Richard Williamson	Bishop	Resistance	\N	\N	\N	1988-06-30	\N	\N	\N	\N	\N	\N	f	\N	\N
55	Oliver Oravec, S.J.	Bishop	Independent	\N	\N	\N	1988-10-21	\N	\N	\N		\N	\N	f	\N	\N
56	Geert Jan Stuyver	Bishop	Institute of the Mother of Good Counsel	\N	\N	\N	2002-01-16	\N	\N	\N		\N	\N	f	\N	\N
58	John E. Hesson	Bishop	Independent	\N	\N	\N	1991-06-12	\N	\N	\N		\N	\N	f	\N	\N
59	Raphaël Cloquell	Bishop	Independent	\N	\N	\N	1996-10-24	\N	\N	\N		\N	\N	f	\N	\N
60	José A. Rodriquez López	Bishop	Independent	\N	\N	\N	\N	\N	\N	\N	Date of consecration unknown.	\N	\N	f	\N	\N
61	Ryan St. Anne Scott	Bishop		\N	\N	\N	1999-05-20	\N	\N	\N		\N	\N	f	\N	\N
53	Richard F. Bedingfeld	Bishop	Independent	\N	\N	\N	1987-12-17	\N	\N	\N	\N	\N	\N	f	\N	\N
62	Dennis McCormack	Bishop		\N	\N	\N	2007-10-01	\N	\N	\N	Exact date is not known.	\N	\N	f	\N	\N
63	Neal R. Webster	Bishop	Independent	\N	\N	\N	2007-11-15	\N	\N	\N		\N	\N	f	\N	\N
64	Paul S. Petko	Bishop	Independent	\N	\N	\N	2011-03-11	\N	\N	\N		\N	\N	f	\N	\N
65	Anton Thai Trinh	Bishop	Independent	\N	\N	\N	2011-10-24	\N	\N	\N		\N	\N	f	\N	\N
66	Robert Dymek	Bishop	Independent	\N	\N	\N	2011-12-27	\N	\N	\N		\N	\N	f	\N	\N
67	Markus Ramolla	Bishop	Independent	\N	\N	\N	2012-05-23	\N	\N	\N		\N	\N	f	\N	\N
68	Edward Peterson	Bishop	Independent	\N	\N	\N	1994-07-29	\N	\N	\N		\N	\N	f	\N	\N
69	Philippe Cochonneaud	Bishop	Independent	\N	\N	\N	1998-11-08	\N	\N	\N		\N	\N	f	\N	\N
70	Victor von Pentz	Bishop	Independent	\N	\N	\N	1998-11-07	\N	\N	\N	'Pope Linus II'	\N	\N	f	\N	\N
72	Pavol Maria Hnilica, S.J.	Bishop		\N	\N	\N	1951-01-01	\N	\N	\N	Consecrated in 1951. Titular Bishop of Rosadus; Underground Slovak Roman Catholic Bishop	\N	\N	f	\N	\N
82	Bernard Tissier de Mallerais	Bishop	Society of St. Pius X	\N	\N	\N	1988-06-30	\N	\N	\N	\N	\N	\N	f	\N	\N
71	Emmanuel Koráb	Bishop	Independent	\N	1998-11-03	\N	1998-11-04	\N	\N	\N	\N	\N	\N	f	\N	\N
74	Michael French	Bishop	Independent	\N	\N	\N	2004-10-16	\N	\N	\N		\N	\N	f	\N	\N
75	Simon Scharf	Bishop	Independent	\N	\N	\N	2018-08-04	\N	\N	\N		\N	\N	f	\N	\N
85	Miguel Ferreira da Costa	Bishop	Union Sacerdotale Marcel Lefebvre	\N	\N	\N	2016-03-19	\N	\N	\N		\N	\N	f	\N	\N
87	António de Castro Mayer	Bishop	Pre Vatican II	\N	\N	\N	\N	\N	\N	\N	Bishop emeritus of Campos, Rio de Janeiro, Brazil	\N	\N	f	\N	\N
73	Pavol Maria Hnilica, S.J.	Bishop	Pre Vatican II	\N	\N	\N	1951-01-01	\N	\N	\N	Titular Bishop of Rosadus; Underground Slovak Roman Catholic Bishop consecrated sometime in 1951	\N	\N	f	\N	\N
83	Licinio Rangel	Bishop	Priestly Union of St. Jean-Marie Vianney	\N	\N	\N	1991-07-28	\N	\N	\N	\N	\N	\N	f	\N	\N
88	Fernando Areas Rifan	Bishop	Priestly Union of St. Jean-Marie Vianney	\N	\N	\N	2002-08-18	\N	\N	\N	\N	\N	\N	f	\N	\N
89	Darío Castrillón Hoyos	Bishop	Post Vatican II	\N	\N	\N	\N	\N	\N	\N	Cardinal post Vatican II. Head of the Ecclesia Dei Commission.	\N	\N	f	\N	\N
76	Clarence Kelly	Bishop	Congregation of St. Pius V	\N	1973-04-14	\N	1993-10-19	\N	\N	2023-12-02	Founded the Congregation of St. Pius V in 1996.	\N	\N	f	\N	\N
22	Pierre Martin Ngô Đình Thục	Archbishop	Pre Vatican II	\N	\N	\N	\N	\N	\N	\N	Archbishop of Huế, Vietnam. Titular Archbishop of Bulla Regia. Archbishop Emeritus of Huê, Vietnam. 	\N	\N	f	\N	\N
93	Giuseppe Melchiorre Sarto	Pope	Pre Vatican II	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	Pius X
92	Giacomo Della Chiesa	Pope	Pre Vatican II	1854-11-21	\N	\N	1907-12-22	\N	\N	1922-01-22	\N	\N	\N	f	\N	Benedict XV
77	Alfredo José Isaac Cecilio Francesco Méndez Gonzalez, C.S.C.	Bishop	Pre Vatican II	\N	\N	\N	1960-10-28	\N	\N	\N	\N	\N	\N	f	\N	\N
91	Eugenio Maria Giuseppe Giovanni Pacelli	Pope	Pre Vatican II	\N	\N	\N	1917-05-13	\N	\N	\N	\N	\N	\N	f	\N	Pius XII
90	Francis Spellman	Cardinal	Pre Vatican II	\N	\N	\N	1932-09-08	\N	\N	\N	\N	\N	\N	f	\N	\N
78	Joseph Santay	Bishop	Congregation of St. Pius V	\N	\N	\N	2007-02-28	\N	\N	\N	\N	\N	\N	f	\N	\N
79	James Carroll	Bishop	Congregation of St. Pius V	\N	\N	\N	2018-12-27	\N	\N	\N	\N	\N	\N	f	\N	\N
80	Bernard Fellay	Bishop	Society of St. Pius X	\N	\N	\N	1988-06-30	\N	\N	\N	\N	\N	\N	f	\N	\N
81	Alphonso de Galarreta	Bishop	Society of St. Pius X	\N	\N	\N	1988-06-30	\N	\N	\N	\N	\N	\N	f	\N	\N
86	Gerardo Zendejas	Bishop	Union Sacerdotale Marcel Lefebvre	\N	\N	\N	2017-05-12	\N	\N	\N	\N	\N	\N	f	\N	\N
84	Jean-Michel Faure	Bishop	Union Sacerdotale Marcel Lefebvre	\N	\N	\N	2015-03-19	\N	\N	\N	\N	\N	\N	f	\N	\N
\.


--
-- Data for Name: clergy_comment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.clergy_comment (id, clergy_id, author_id, content, field_name, is_public, is_resolved, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: co_consecrators; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.co_consecrators (consecration_id, co_consecrator_id) FROM stdin;
\.


--
-- Data for Name: consecration; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.consecration (id, clergy_id, date, consecrator_id, is_sub_conditione, is_doubtful, is_invalid, notes, created_at, updated_at) FROM stdin;
436	19	2025-09-19	17	f	f	f	Migrated consecration for Robert L. Neville	2025-09-19 23:32:53.003474	2025-09-19 23:32:53.003475
437	57	2025-09-19	17	f	f	f	Migrated consecration for Andrès Morello	2025-09-19 23:32:53.003751	2025-09-19 23:32:53.003751
438	23	2025-09-19	17	f	f	f	Migrated consecration for Michel Louis Guérard des Lauriers, O.P.	2025-09-19 23:32:53.003887	2025-09-19 23:32:53.003888
439	25	2025-09-19	17	f	f	f	Migrated consecration for Mark Anthony Pivarunas	2025-09-19 23:32:53.003975	2025-09-19 23:32:53.003976
440	26	2025-09-19	17	f	f	f	Migrated consecration for George Musey	2025-09-19 23:32:53.004061	2025-09-19 23:32:53.004062
441	36	2025-09-19	17	f	f	f	Migrated consecration for Christian Datessen	2025-09-19 23:32:53.004171	2025-09-19 23:32:53.004171
442	27	2025-09-19	17	f	f	f	Migrated consecration for Louis Vezelis, OFM	2025-09-19 23:32:53.004257	2025-09-19 23:32:53.004257
443	28	2025-09-19	17	f	f	f	Migrated consecration for Jean Laborie	2025-09-19 23:32:53.004342	2025-09-19 23:32:53.004343
444	37	2025-09-19	17	f	f	f	Migrated consecration for Luigi Boni	2025-09-19 23:32:53.004424	2025-09-19 23:32:53.004425
445	21	2025-09-19	17	f	f	f	Migrated consecration for Franco Munari	2025-09-19 23:32:53.004507	2025-09-19 23:32:53.004507
446	1	2025-09-19	17	f	f	f	Migrated consecration for Donald J. Sanborn	2025-09-19 23:32:53.004594	2025-09-19 23:32:53.004595
447	2	2025-09-19	17	f	f	f	Migrated consecration for Joseph S. Selway	2025-09-19 23:32:53.004684	2025-09-19 23:32:53.004685
448	3	2025-09-19	17	f	f	f	Migrated consecration for Germán Fliess	2025-09-19 23:32:53.004776	2025-09-19 23:32:53.004777
449	48	2025-09-19	17	f	f	f	Migrated consecration for Giles Butler, O.F.M.	2025-09-19 23:32:53.004866	2025-09-19 23:32:53.004867
450	38	2025-09-19	17	f	f	f	Migrated consecration for Claude Nanta de Torrini	2025-09-19 23:32:53.004975	2025-09-19 23:32:53.004975
451	24	2025-09-19	17	f	f	f	Migrated consecration for Moisés Carmona y Rivera	2025-09-19 23:32:53.005065	2025-09-19 23:32:53.005066
452	16	2025-09-19	17	f	f	f	Migrated consecration for Marcel Lefebvre	2025-09-19 23:32:53.005168	2025-09-19 23:32:53.005169
453	35	2025-09-19	17	f	f	f	Migrated consecration for Adolfo Zamora Hernandez	2025-09-19 23:32:53.005255	2025-09-19 23:32:53.005255
454	54	2025-09-19	17	f	f	f	Migrated consecration for Francis Słupski, C.S.S.R.	2025-09-19 23:32:53.005337	2025-09-19 23:32:53.005338
455	30	2025-09-19	17	f	f	f	Migrated consecration for Timothy Hennebery	2025-09-19 23:32:53.005418	2025-09-19 23:32:53.005418
456	29	2025-09-19	17	f	f	f	Migrated consecration for Raymond Maurice Terrasson	2025-09-19 23:32:53.005499	2025-09-19 23:32:53.005499
457	44	2025-09-19	17	f	f	f	Migrated consecration for Martin Davila Gandara	2025-09-19 23:32:53.005597	2025-09-19 23:32:53.005598
458	34	2025-09-19	17	f	f	f	Migrated consecration for Francis B. Sandler, O.S.B.	2025-09-19 23:32:53.007743	2025-09-19 23:32:53.007744
459	39	2025-09-19	17	f	f	f	Migrated consecration for Benigno Bravo Valades	2025-09-19 23:32:53.007825	2025-09-19 23:32:53.007825
460	40	2025-09-19	17	f	f	f	Migrated consecration for Roberto Martinez	2025-09-19 23:32:53.007882	2025-09-19 23:32:53.007882
461	41	2025-09-19	17	f	f	f	Migrated consecration for Santiago de la Cuz Corona	2025-09-19 23:32:53.007933	2025-09-19 23:32:53.007934
462	42	2025-09-19	17	f	f	f	Migrated consecration for Peter Hillebrand	2025-09-19 23:32:53.007985	2025-09-19 23:32:53.007985
463	31	2025-09-19	17	f	f	f	Migrated consecration for Clemente Ferdinand Domingez Gómez 	2025-09-19 23:32:53.008039	2025-09-19 23:32:53.00804
464	49	2025-09-19	17	f	f	f	Migrated consecration for Luis Alberto Madrigal	2025-09-19 23:32:53.008114	2025-09-19 23:32:53.008114
465	43	2025-09-19	17	f	f	f	Migrated consecration for Daniel Lytle Dolan	2025-09-19 23:32:53.008169	2025-09-19 23:32:53.00817
466	45	2025-09-19	17	f	f	f	Migrated consecration for Ralph Siebert	2025-09-19 23:32:53.008219	2025-09-19 23:32:53.008219
467	46	2025-09-19	17	f	f	f	Migrated consecration for Conrad Altenbach	2025-09-19 23:32:53.008269	2025-09-19 23:32:53.008269
468	47	2025-09-19	17	f	f	f	Migrated consecration for Philippe Miguet	2025-09-19 23:32:53.008318	2025-09-19 23:32:53.008319
469	50	2025-09-19	17	f	f	f	Migrated consecration for Bonaventure Strandt	2025-09-19 23:32:53.008369	2025-09-19 23:32:53.00837
470	51	2025-09-19	17	f	f	f	Migrated consecration for Gunther Stork	2025-09-19 23:32:53.00842	2025-09-19 23:32:53.00842
471	52	2025-09-19	17	f	f	f	Migrated consecration for J. Elmer Vida	2025-09-19 23:32:53.008469	2025-09-19 23:32:53.008469
472	18	2025-09-19	17	f	f	f	Migrated consecration for Richard Williamson	2025-09-19 23:32:53.008525	2025-09-19 23:32:53.008526
473	55	2025-09-19	17	f	f	f	Migrated consecration for Oliver Oravec, S.J.	2025-09-19 23:32:53.008577	2025-09-19 23:32:53.008578
474	56	2025-09-19	17	f	f	f	Migrated consecration for Geert Jan Stuyver	2025-09-19 23:32:53.008629	2025-09-19 23:32:53.00863
475	58	2025-09-19	17	f	f	f	Migrated consecration for John E. Hesson	2025-09-19 23:32:53.008687	2025-09-19 23:32:53.008688
476	59	2025-09-19	17	f	f	f	Migrated consecration for Raphaël Cloquell	2025-09-19 23:32:53.008739	2025-09-19 23:32:53.008739
477	60	2025-09-19	17	f	f	f	Migrated consecration for José A. Rodriquez López	2025-09-19 23:32:53.008788	2025-09-19 23:32:53.008788
478	61	2025-09-19	17	f	f	f	Migrated consecration for Ryan St. Anne Scott	2025-09-19 23:32:53.008837	2025-09-19 23:32:53.008837
479	53	2025-09-19	17	f	f	f	Migrated consecration for Richard F. Bedingfeld	2025-09-19 23:32:53.008886	2025-09-19 23:32:53.008887
480	62	2025-09-19	17	f	f	f	Migrated consecration for Dennis McCormack	2025-09-19 23:32:53.008935	2025-09-19 23:32:53.008936
481	63	2025-09-19	17	f	f	f	Migrated consecration for Neal R. Webster	2025-09-19 23:32:53.008984	2025-09-19 23:32:53.008984
482	64	2025-09-19	17	f	f	f	Migrated consecration for Paul S. Petko	2025-09-19 23:32:53.009035	2025-09-19 23:32:53.009035
483	65	2025-09-19	17	f	f	f	Migrated consecration for Anton Thai Trinh	2025-09-19 23:32:53.009164	2025-09-19 23:32:53.009165
484	66	2025-09-19	17	f	f	f	Migrated consecration for Robert Dymek	2025-09-19 23:32:53.009234	2025-09-19 23:32:53.009234
485	67	2025-09-19	17	f	f	f	Migrated consecration for Markus Ramolla	2025-09-19 23:32:53.009285	2025-09-19 23:32:53.009286
486	68	2025-09-19	17	f	f	f	Migrated consecration for Edward Peterson	2025-09-19 23:32:53.009339	2025-09-19 23:32:53.00934
487	69	2025-09-19	17	f	f	f	Migrated consecration for Philippe Cochonneaud	2025-09-19 23:32:53.009394	2025-09-19 23:32:53.009394
488	70	2025-09-19	17	f	f	f	Migrated consecration for Victor von Pentz	2025-09-19 23:32:53.009444	2025-09-19 23:32:53.009444
489	72	2025-09-19	17	f	f	f	Migrated consecration for Pavol Maria Hnilica, S.J.	2025-09-19 23:32:53.009493	2025-09-19 23:32:53.009494
490	82	2025-09-19	17	f	f	f	Migrated consecration for Bernard Tissier de Mallerais	2025-09-19 23:32:53.009543	2025-09-19 23:32:53.009544
491	71	2025-09-19	17	f	f	f	Migrated consecration for Emmanuel Koráb	2025-09-19 23:32:53.009593	2025-09-19 23:32:53.009593
492	74	2025-09-19	17	f	f	f	Migrated consecration for Michael French	2025-09-19 23:32:53.009642	2025-09-19 23:32:53.009642
493	75	2025-09-19	17	f	f	f	Migrated consecration for Simon Scharf	2025-09-19 23:32:53.009696	2025-09-19 23:32:53.009697
494	85	2025-09-19	17	f	f	f	Migrated consecration for Miguel Ferreira da Costa	2025-09-19 23:32:53.009746	2025-09-19 23:32:53.009746
495	87	2025-09-19	17	f	f	f	Migrated consecration for António de Castro Mayer	2025-09-19 23:32:53.009801	2025-09-19 23:32:53.009801
496	73	2025-09-19	17	f	f	f	Migrated consecration for Pavol Maria Hnilica, S.J.	2025-09-19 23:32:53.009857	2025-09-19 23:32:53.009858
497	83	2025-09-19	17	f	f	f	Migrated consecration for Licinio Rangel	2025-09-19 23:32:53.009908	2025-09-19 23:32:53.009909
498	88	2025-09-19	17	f	f	f	Migrated consecration for Fernando Areas Rifan	2025-09-19 23:32:53.009957	2025-09-19 23:32:53.009957
499	89	2025-09-19	17	f	f	f	Migrated consecration for Darío Castrillón Hoyos	2025-09-19 23:32:53.010006	2025-09-19 23:32:53.010007
500	76	2025-09-19	17	f	f	f	Migrated consecration for Clarence Kelly	2025-09-19 23:32:53.010056	2025-09-19 23:32:53.010057
501	22	2025-09-19	17	f	f	f	Migrated consecration for Pierre Martin Ngô Đình Thục	2025-09-19 23:32:53.010129	2025-09-19 23:32:53.01013
502	77	2025-09-19	17	f	f	f	Migrated consecration for Alfredo José Isaac Cecilio Francesco Méndez Gonzalez, C.S.C.	2025-09-19 23:32:53.010182	2025-09-19 23:32:53.010182
503	78	2025-09-19	17	f	f	f	Migrated consecration for Joseph Santay	2025-09-19 23:32:53.010231	2025-09-19 23:32:53.010231
504	79	2025-09-19	17	f	f	f	Migrated consecration for James Carroll	2025-09-19 23:32:53.01028	2025-09-19 23:32:53.010281
505	80	2025-09-19	17	f	f	f	Migrated consecration for Bernard Fellay	2025-09-19 23:32:53.01033	2025-09-19 23:32:53.01033
506	81	2025-09-19	17	f	f	f	Migrated consecration for Alphonso de Galarreta	2025-09-19 23:32:53.010386	2025-09-19 23:32:53.010386
507	86	2025-09-19	17	f	f	f	Migrated consecration for Gerardo Zendejas	2025-09-19 23:32:53.010434	2025-09-19 23:32:53.010435
508	84	2025-09-19	17	f	f	f	Migrated consecration for Jean-Michel Faure	2025-09-19 23:32:53.010482	2025-09-19 23:32:53.010482
\.


--
-- Data for Name: ordination; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ordination (id, clergy_id, date, ordaining_bishop_id, is_sub_conditione, is_doubtful, is_invalid, notes, created_at, updated_at) FROM stdin;
78	8	2025-09-19	17	f	f	f	Migrated ordination for Damien Dutertre	2025-09-19 23:32:53.002086	2025-09-19 23:32:53.002087
79	14	2025-09-19	17	f	f	f	Migrated ordination for Aedan Gilchrist	2025-09-19 23:32:53.002638	2025-09-19 23:32:53.002639
80	10	2025-09-19	17	f	f	f	Migrated ordination for Henry de La Chanonie	2025-09-19 23:32:53.002758	2025-09-19 23:32:53.002758
81	4	2025-09-19	17	f	f	f	Migrated ordination for Nicolás E. Despósito	2025-09-19 23:32:53.002838	2025-09-19 23:32:53.002838
82	11	2025-09-19	17	f	f	f	Migrated ordination for Michael DeSaye	2025-09-19 23:32:53.002892	2025-09-19 23:32:53.002893
83	6	2025-09-19	17	f	f	f	Migrated ordination for Ojciec Rafal Trytek	2025-09-19 23:32:53.002946	2025-09-19 23:32:53.002946
84	15	2025-09-19	17	f	f	f	Migrated ordination for James Marshall	2025-09-19 23:32:53.002996	2025-09-19 23:32:53.002997
85	7	2025-09-19	17	f	f	f	Migrated ordination for Philip A. Eldracher	2025-09-19 23:32:53.003045	2025-09-19 23:32:53.003046
86	13	2025-09-19	17	f	f	f	Migrated ordination for Gregory Barnes	2025-09-19 23:32:53.003113	2025-09-19 23:32:53.003113
87	12	2025-09-19	17	f	f	f	Migrated ordination for Tobias Bayer	2025-09-19 23:32:53.003374	2025-09-19 23:32:53.003374
\.


--
-- Data for Name: organization; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.organization (id, name, abbreviation, description, color, created_at) FROM stdin;
2	Independent	IND		#919191	2025-07-20 03:12:51.485887
4	Society of St. Pius X	SSPX		#ffaf24	2025-08-28 13:27:10.606713
5	Resistance	R		#7b7aae	2025-08-28 13:28:36.756528
6	Congregation of Mary Immaculate Queen	CMRI		#38bdff	2025-08-28 13:59:48.044549
3	Institute of the Mother of Good Counsel	IMBC		#1b0aff	2025-07-21 19:32:34.704789
7	Palmarian	PLM		#dc7aff	2025-09-02 11:27:28.845109
8	Society of Trento, Mexico	STM		#e7f8b9	2025-09-14 19:24:46.227512
9	Saint Gertrude the Great	SGG		#6dab93	2025-09-14 19:37:15.696525
10	Pre Vatican II	PreV2		#ff4242	2025-09-15 01:19:17.933826
11	Congregation of St. Pius V	SSPV		#ffaded	2025-09-15 01:34:58.918957
13	Union Sacerdotale Marcel Lefebvre	USML		#f57b47	2025-09-15 01:48:58.493907
1	Roman Catholic Institute	RCI		#930101	2025-07-19 06:30:55.660294
12	Priestly Union of St. Jean-Marie Vianney	PUJMV		#b3007a	2025-09-15 01:47:49.232646
14	Post Vatican II	PostV2	Consecrated with the new rite of consecration.	#000000	2025-09-15 12:26:07.000573
\.


--
-- Data for Name: permission; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.permission (id, name, description, created_at) FROM stdin;
1	view_clergy	View clergy records	2025-07-19 20:08:18.989158
2	add_clergy	Add new clergy records	2025-07-19 20:08:18.992844
3	edit_clergy	Edit existing clergy records	2025-07-19 20:08:18.996059
4	delete_clergy	Delete clergy records	2025-07-19 20:08:18.998889
5	manage_metadata	Manage ranks and organizations	2025-07-19 20:08:19.032444
6	manage_users	Manage user accounts and roles	2025-07-19 20:08:19.036333
7	add_comments	Add comments to clergy records	2025-07-19 20:08:19.04095
8	view_comments	View comments on clergy records	2025-07-19 20:08:19.04355
9	resolve_comments	Resolve comments and feedback	2025-07-19 20:08:19.046097
10	view_lineage	View lineage visualization	2025-07-19 20:08:19.048683
11	export_data	Export data from the system	2025-07-19 20:08:19.051124
12	view_audit_logs	View audit logs and system history	2025-07-19 20:08:19.053645
\.


--
-- Data for Name: rank; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rank (id, name, description, color, created_at, is_bishop) FROM stdin;
2	Priest		#000000	2025-07-20 03:12:24.803514	f
1	Bishop		#008f3e	2025-07-19 06:30:21.188338	f
3	Cardinal		#ff0000	2025-09-15 14:24:07.850799	f
4	Pope		#ffffff	2025-09-15 14:24:16.835123	f
5	Archbishop		#009402	2025-09-15 14:24:30.553161	f
\.


--
-- Data for Name: role; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.role (id, name, description, created_at) FROM stdin;
1	Super Admin	Full system access and administration	2025-09-19 18:39:10.22037
2	Admin	System administration with limited user management	2025-09-19 18:39:10.28049
3	Editor	Full content management capabilities	2025-09-19 18:39:10.309406
4	Contributor	Can add and edit clergy records with approval workflow	2025-09-19 18:39:10.368896
5	Reviewer	Can view records and provide feedback	2025-09-19 18:39:10.390628
6	Viewer	Read-only access to clergy records and lineage	2025-09-19 18:39:10.410193
\.


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.role_permissions (role_id, permission_id) FROM stdin;
1	1
1	2
1	3
1	4
1	5
1	6
1	7
1	8
1	9
1	10
1	11
1	12
2	1
2	2
2	3
2	4
2	5
2	7
2	8
2	9
2	10
2	11
3	1
3	2
3	3
3	7
3	8
3	10
4	1
4	7
4	8
4	10
5	1
5	10
6	1
6	2
6	3
6	4
6	5
6	7
6	8
6	9
6	10
6	11
6	12
2	12
3	4
3	5
3	9
3	11
4	2
4	3
5	7
5	8
\.


--
-- Data for Name: user; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."user" (id, username, password_hash, is_admin, email, full_name, is_active, created_at, last_login, role_id) FROM stdin;
2	andreas.ripensis	pbkdf2:sha256:600000$JUG8HNqDydUzgQzY$ccf1eda0d642249875b269f70436210760f10f2f49338ebe7825caf3b7879f62	\N	\N	\N	t	2025-07-22 03:37:08.792697	2025-07-22 03:37:20.68583	6
1	admin	pbkdf2:sha256:600000$WdKEN7BeEwdNgpxl$bb927b4ec5b77bf131cd49c9beb937ce3edc84762d274a16a368a7e3da861ab2	t	\N	\N	t	2025-07-19 20:08:19.261607	2025-09-19 22:25:46.643205	1
\.


--
-- Name: admin_invite_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.admin_invite_id_seq', 2, true);


--
-- Name: audit_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.audit_log_id_seq', 211, true);


--
-- Name: clergy_comment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.clergy_comment_id_seq', 1, true);


--
-- Name: clergy_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.clergy_id_seq', 93, true);


--
-- Name: consecration_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.consecration_id_seq', 508, true);


--
-- Name: ordination_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ordination_id_seq', 87, true);


--
-- Name: organization_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.organization_id_seq', 14, true);


--
-- Name: permission_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.permission_id_seq', 12, true);


--
-- Name: rank_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.rank_id_seq', 5, true);


--
-- Name: role_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.role_id_seq', 6, true);


--
-- Name: user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.user_id_seq', 4, true);


--
-- Name: admin_invite admin_invite_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_invite
    ADD CONSTRAINT admin_invite_pkey PRIMARY KEY (id);


--
-- Name: admin_invite admin_invite_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_invite
    ADD CONSTRAINT admin_invite_token_key UNIQUE (token);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: clergy_comment clergy_comment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clergy_comment
    ADD CONSTRAINT clergy_comment_pkey PRIMARY KEY (id);


--
-- Name: clergy clergy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clergy
    ADD CONSTRAINT clergy_pkey PRIMARY KEY (id);


--
-- Name: co_consecrators co_consecrators_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.co_consecrators
    ADD CONSTRAINT co_consecrators_pkey PRIMARY KEY (consecration_id, co_consecrator_id);


--
-- Name: consecration consecration_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consecration
    ADD CONSTRAINT consecration_pkey PRIMARY KEY (id);


--
-- Name: ordination ordination_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordination
    ADD CONSTRAINT ordination_pkey PRIMARY KEY (id);


--
-- Name: organization organization_abbreviation_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization
    ADD CONSTRAINT organization_abbreviation_key UNIQUE (abbreviation);


--
-- Name: organization organization_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization
    ADD CONSTRAINT organization_name_key UNIQUE (name);


--
-- Name: organization organization_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization
    ADD CONSTRAINT organization_pkey PRIMARY KEY (id);


--
-- Name: permission permission_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission
    ADD CONSTRAINT permission_name_key UNIQUE (name);


--
-- Name: permission permission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission
    ADD CONSTRAINT permission_pkey PRIMARY KEY (id);


--
-- Name: rank rank_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rank
    ADD CONSTRAINT rank_name_key UNIQUE (name);


--
-- Name: rank rank_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rank
    ADD CONSTRAINT rank_pkey PRIMARY KEY (id);


--
-- Name: role role_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role
    ADD CONSTRAINT role_name_key UNIQUE (name);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: role role_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role
    ADD CONSTRAINT role_pkey PRIMARY KEY (id);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- Name: user user_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_username_key UNIQUE (username);


--
-- Name: admin_invite admin_invite_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_invite
    ADD CONSTRAINT admin_invite_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public."user"(id);


--
-- Name: audit_log audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id);


--
-- Name: clergy_comment clergy_comment_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clergy_comment
    ADD CONSTRAINT clergy_comment_author_id_fkey FOREIGN KEY (author_id) REFERENCES public."user"(id);


--
-- Name: clergy_comment clergy_comment_clergy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clergy_comment
    ADD CONSTRAINT clergy_comment_clergy_id_fkey FOREIGN KEY (clergy_id) REFERENCES public.clergy(id);


--
-- Name: clergy clergy_consecrator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clergy
    ADD CONSTRAINT clergy_consecrator_id_fkey FOREIGN KEY (consecrator_id) REFERENCES public.clergy(id);


--
-- Name: clergy clergy_ordaining_bishop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clergy
    ADD CONSTRAINT clergy_ordaining_bishop_id_fkey FOREIGN KEY (ordaining_bishop_id) REFERENCES public.clergy(id);


--
-- Name: co_consecrators co_consecrators_co_consecrator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.co_consecrators
    ADD CONSTRAINT co_consecrators_co_consecrator_id_fkey FOREIGN KEY (co_consecrator_id) REFERENCES public.clergy(id);


--
-- Name: co_consecrators co_consecrators_consecration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.co_consecrators
    ADD CONSTRAINT co_consecrators_consecration_id_fkey FOREIGN KEY (consecration_id) REFERENCES public.consecration(id);


--
-- Name: consecration consecration_clergy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consecration
    ADD CONSTRAINT consecration_clergy_id_fkey FOREIGN KEY (clergy_id) REFERENCES public.clergy(id);


--
-- Name: consecration consecration_consecrator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consecration
    ADD CONSTRAINT consecration_consecrator_id_fkey FOREIGN KEY (consecrator_id) REFERENCES public.clergy(id);


--
-- Name: ordination ordination_clergy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordination
    ADD CONSTRAINT ordination_clergy_id_fkey FOREIGN KEY (clergy_id) REFERENCES public.clergy(id);


--
-- Name: ordination ordination_ordaining_bishop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordination
    ADD CONSTRAINT ordination_ordaining_bishop_id_fkey FOREIGN KEY (ordaining_bishop_id) REFERENCES public.clergy(id);


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permission(id);


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.role(id);


--
-- PostgreSQL database dump complete
--


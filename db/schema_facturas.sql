--
-- PostgreSQL database dump
--

\restrict GLSuvbWZCAVGc5a27J7uSmNnirEFW9eyxHOd0OzfYZtNgKEaKuDV8ytQHZoO18A

-- Dumped from database version 14.22 (Ubuntu 14.22-0ubuntu0.22.04.1)
-- Dumped by pg_dump version 14.22 (Ubuntu 14.22-0ubuntu0.22.04.1)

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: facturas_electronicas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.facturas_electronicas (
    id smallint NOT NULL,
    contenido_xml text DEFAULT NULL::character varying,
    fecha_creacion character varying(30) DEFAULT NULL::character varying,
    fecha_actualizacion character varying(30) DEFAULT NULL::character varying,
    numero_factura character varying(16) DEFAULT NULL::character varying,
    fecha_emision character varying(10) DEFAULT NULL::character varying,
    ruc_emisor character varying(11),
    ruc_receptor character varying(11),
    monto_total numeric(7,2) DEFAULT NULL::numeric,
    serie_numero_guia character varying(11) DEFAULT NULL::character varying,
    nombre_receptor character varying(100) DEFAULT NULL::character varying,
    nombre_emisor character varying(100) DEFAULT 'HEINZ SPORT S.A.C.'::character varying,
    codigo_moneda character varying(3) DEFAULT 'PEN'::character varying,
    move_type character varying NOT NULL,
    payment_status character varying DEFAULT 'not_paid'::character varying NOT NULL,
    state character varying DEFAULT 'draft'::character varying NOT NULL,
    amount_tax numeric,
    amount_untaxed numeric,
    invoice_currency_rate numeric DEFAULT 1,
    CONSTRAINT chk_facturas_move_type CHECK (((move_type)::text = ANY ((ARRAY['in_invoice'::character varying, 'out_invoice'::character varying, 'entry'::character varying])::text[]))),
    CONSTRAINT chk_facturas_payment_status CHECK (((payment_status)::text = ANY ((ARRAY['paid'::character varying, 'not_paid'::character varying])::text[]))),
    CONSTRAINT chk_facturas_state_type CHECK (((state)::text = ANY ((ARRAY['draft'::character varying, 'posted'::character varying, 'cancel'::character varying])::text[])))
);


ALTER TABLE public.facturas_electronicas OWNER TO postgres;

--
-- Name: facturas_electronicas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.facturas_electronicas_id_seq
    START WITH 184
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.facturas_electronicas_id_seq OWNER TO postgres;

--
-- Name: facturas_electronicas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.facturas_electronicas_id_seq OWNED BY public.facturas_electronicas.id;


--
-- Name: facturas_electronicas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.facturas_electronicas ALTER COLUMN id SET DEFAULT nextval('public.facturas_electronicas_id_seq'::regclass);


--
-- Name: facturas_electronicas facturas_electronicas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.facturas_electronicas
    ADD CONSTRAINT facturas_electronicas_pkey PRIMARY KEY (id);


--
-- Name: facturas_electronicas unique_numero_factura; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.facturas_electronicas
    ADD CONSTRAINT unique_numero_factura UNIQUE (numero_factura);


--
-- PostgreSQL database dump complete
--

\unrestrict GLSuvbWZCAVGc5a27J7uSmNnirEFW9eyxHOd0OzfYZtNgKEaKuDV8ytQHZoO18A


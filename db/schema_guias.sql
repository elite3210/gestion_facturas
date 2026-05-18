--  schema de guia de remision y factura electronica
-- PostgreSQL database dump
-- PostgreSQL version 14

-- Dumped from database version 14.18 (Ubuntu 14.18-0ubuntu0.22.04.1)
-- Dumped by pg_dump version 14.18 (Ubuntu 14.18-0ubuntu0.22.04.1)

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
-- Name: guias_remision; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.guias_remision (
    id smallint,
    numero_guia character varying(20) DEFAULT NULL::character varying,
    fecha_emision character varying(10) DEFAULT NULL::character varying,
    ruc_emisor character varying(11),
    nombre_emisor character varying(100) DEFAULT NULL::character varying,
    ruc_receptor character varying(11),
    nombre_receptor character varying(85) DEFAULT NULL::character varying,
    motivo_traslado character varying(28) DEFAULT NULL::character varying,
    peso_bruto numeric(6,2) DEFAULT NULL::numeric,
    punto_partida character varying(200) DEFAULT NULL::character varying,
    punto_llegada character varying(200) DEFAULT NULL::character varying,
    fecha_traslado character varying(10) DEFAULT NULL::character varying,
    contenido_xml text DEFAULT NULL::character varying,
    fecha_registro character varying(30) DEFAULT NULL::character varying,
    numero_factura character varying(11) DEFAULT NULL::character varying
);


ALTER TABLE public.guias_remision OWNER TO postgres;

--
-- Name: guias_remision_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.guias_remision_id_seq
    START WITH 110
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.guias_remision_id_seq OWNER TO postgres;

--
-- Name: guias_remision_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.guias_remision_id_seq OWNED BY public.guias_remision.id;



--
-- Name: facturas_electronicas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.facturas_electronicas ALTER COLUMN id SET DEFAULT nextval('public.facturas_electronicas_id_seq'::regclass);


--
-- Name: guias_remision id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.guias_remision ALTER COLUMN id SET DEFAULT nextval('public.guias_remision_id_seq'::regclass);


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


ALTER TABLE public.guias_remision 
ADD CONSTRAINT unique_numero_guia UNIQUE (numero_guia);

--
-- PostgreSQL database dump complete
--


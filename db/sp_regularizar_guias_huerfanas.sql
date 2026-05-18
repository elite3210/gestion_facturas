CREATE OR REPLACE PROCEDURE public.sp_regularizar_guias_huerfanas()
LANGUAGE plpgsql
AS $$
BEGIN
    -- Ejecuta la actualización masiva de guías vacías
    UPDATE public.guias_remision g
    SET numero_factura = f.numero_factura
    FROM public.facturas_electronicas f
    WHERE g.numero_guia = f.serie_numero_guia
      AND (g.numero_factura IS NULL OR TRIM(g.numero_factura) = '');

    -- Imprime un mensaje en la consola de Postgres (opcional para depuración)
    RAISE NOTICE 'Regularización de guías completada con éxito.';
END;
$$;

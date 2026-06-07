-- Function that returns distinct banco+moneda+month combinations for the coverage panel.
-- Avoids fetching all rows through PostgREST (which has a server-side row limit).
create or replace function get_coverage_months()
returns table(banco text, moneda text, ym text)
language sql
security definer
stable
as $$
  select
    banco::text,
    moneda::text,
    to_char(fecha::date, 'YYYY-MM') as ym
  from bank_statements
  group by banco, moneda, to_char(fecha::date, 'YYYY-MM')
  order by ym;
$$;

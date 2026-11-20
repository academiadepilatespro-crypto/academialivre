alter table public.config_estudio
  add column if not exists intervalo_almoco_inicio time without time zone,
  add column if not exists intervalo_almoco_fim time without time zone;

alter table public.config_estudio
  drop constraint if exists config_estudio_intervalo_almoco_check;

alter table public.config_estudio
  add constraint config_estudio_intervalo_almoco_check
  check (
    (intervalo_almoco_inicio is null and intervalo_almoco_fim is null)
    or (
      intervalo_almoco_inicio is not null
      and intervalo_almoco_fim is not null
      and intervalo_almoco_fim > intervalo_almoco_inicio
      and intervalo_almoco_inicio >= horario_abertura
      and intervalo_almoco_fim <= horario_fechamento
    )
  );

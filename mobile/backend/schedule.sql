-- Ya configurado. Este script es documentación para una instalación nueva.
select cron.schedule('vmgc-mobile-published-releases','17 * * * *',$job$
 select net.http_post(
  url := 'https://bnnfolhrqxgxjmobclrm.supabase.co/functions/v1/mobile-release-sync',
  headers := jsonb_build_object('Content-Type','application/json','x-vmgc-sync',(select token from public.mobile_release_sync_state where id=1)),
  body := '{}'::jsonb,
  timeout_milliseconds := 60000
 );
$job$);

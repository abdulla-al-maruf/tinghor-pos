insert into profiles (id, name, email, role)
values ('993762fa-f51b-45ef-8953-2fbad3a7a808', 'মালিক', 'justin@jbdsupplyent.com', 'admin')
on conflict (id) do update set role = 'admin', name = 'মালিক';

select id, name, email, role from profiles;

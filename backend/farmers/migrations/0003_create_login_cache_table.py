from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("farmers", "0002_ci_unique_user_identifiers"),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                "CREATE TABLE django_cache ("
                "cache_key varchar(255) NOT NULL PRIMARY KEY, "
                "value text NOT NULL, "
                "expires timestamp with time zone NOT NULL"
                ")"
            ),
            reverse_sql="DROP TABLE IF EXISTS django_cache",
        ),
    ]

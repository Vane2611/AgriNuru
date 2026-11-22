from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("farmers", "0001_initial"),
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                'CREATE UNIQUE INDEX farmers_user_username_ci_unique '
                'ON auth_user (LOWER(username));'
            ),
            reverse_sql="DROP INDEX IF EXISTS farmers_user_username_ci_unique;",
        ),
        migrations.RunSQL(
            sql=(
                'CREATE UNIQUE INDEX farmers_user_email_ci_unique '
                'ON auth_user (LOWER(email)) '
                "WHERE email <> '';"
            ),
            reverse_sql="DROP INDEX IF EXISTS farmers_user_email_ci_unique;",
        ),
    ]

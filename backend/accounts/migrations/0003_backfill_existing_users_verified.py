"""既存ユーザーを is_email_verified=True で埋める。

本機能導入前に登録されたユーザーは検証メールを送れていないので、
互換性のため既存全員を verified 扱いとする（spec §10 採用方針 A）。
"""

from django.db import migrations
from django.utils import timezone


def backfill_verified(apps, schema_editor):
    CustomUser = apps.get_model("accounts", "CustomUser")
    now = timezone.now()
    CustomUser.objects.filter(is_email_verified=False).update(
        is_email_verified=True,
        email_verified_at=now,
    )


def reverse_backfill(apps, schema_editor):
    # ロールバック時は何もしない（誤って未確認に戻すと既存ユーザーが詰むため）
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_customuser_email_verified_at_and_more'),
    ]

    operations = [
        migrations.RunPython(backfill_verified, reverse_backfill),
    ]

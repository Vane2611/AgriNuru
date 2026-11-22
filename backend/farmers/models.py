from django.conf import settings
from django.core.validators import RegexValidator
from django.db import models


phone_number_validator = RegexValidator(
    regex=r"^\+?[0-9][0-9().\-\s]{4,30}$",
    message=(
        "Enter a phone number using digits and optional spaces, parentheses, "
        "periods, hyphens or a leading plus sign."
    ),
)


language_tag_validator = RegexValidator(
    regex=r"^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$",
    message="Enter a language tag such as 'en' or 'sw-KE'.",
)


class FarmerProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="farmer_profile",
    )
    phone_number = models.CharField(
        max_length=32,
        blank=True,
        validators=[phone_number_validator],
    )
    preferred_language = models.CharField(
        max_length=35,
        blank=True,
        validators=[language_tag_validator],
        help_text="Language tag, for example 'en' or 'sw-KE'.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "farmer profile"
        verbose_name_plural = "farmer profiles"
        ordering = ("user_id",)

    def __str__(self):
        display_name = self.user.get_full_name().strip() or self.user.get_username()
        return f"Farmer profile: {display_name}"

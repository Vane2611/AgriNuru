from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsAuthenticatedReadOnlyOrStaffWrite(BasePermission):
    message = "Only staff users may modify the crop catalogue."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (request.method in SAFE_METHODS or user.is_staff)
        )

"""Shared form context for clergy form panel and form content endpoints."""


class FormFields:
    """Shared form context for clergy form panel and form content endpoints."""

    def __init__(self, ranks, organizations, statuses):
        self.ranks = ranks
        self.organizations = organizations
        self.statuses = statuses
        self.form_action = None
        self.cancel_url = None

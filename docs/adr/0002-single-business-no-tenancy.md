# Build for a single business, with no tenancy

GasFlow is built for one client and will not be sold to other agencies, so there are no `firm_id` columns, agency subdomains or Clerk Organizations. This departs from the build blueprint, which carries a firm key on every table; the key was dropped rather than kept "just in case" because it would complicate every query and constraint for a use that is not planned.

## Consequences

Serving a second business from the same installation later would mean adding tenancy to the schema, every query and sign-in. A separate deployment per business remains possible without that work.

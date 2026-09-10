export class UpstreamCloudDisabledError extends Error {
  readonly code = "UPSTREAM_CLOUD_DISABLED"
  readonly isRetryable = false

  constructor() {
    super(
      "Upstream cloud services are disabled. Sign in to TranslateBuff or select an available model.",
    )
    this.name = "UpstreamCloudDisabledError"
  }
}

import {
  validateModelDescriptor,
  validateProviderDescriptor,
  type ModelDescriptor,
  type ProviderDescriptor,
} from "./model-contract";
import type { ModelProviderAdapter } from "./provider-contract";

export type RegistryErrorCode =
  | "registry_disposed"
  | "invalid_provider"
  | "invalid_model"
  | "duplicate_provider"
  | "duplicate_model"
  | "provider_model_mismatch"
  | "provider_active";

export class RegistryError extends Error {
  readonly code: RegistryErrorCode;

  constructor(code: RegistryErrorCode, message: string) {
    super(message);
    this.name = "RegistryError";
    this.code = code;
  }
}

export interface RegisteredProviderSnapshot {
  readonly descriptor: ProviderDescriptor;
  readonly models: readonly ModelDescriptor[];
}

function freezeProviderDescriptor(descriptor: ProviderDescriptor): ProviderDescriptor {
  Object.freeze(descriptor.capabilities);
  Object.freeze(descriptor.supportedInputModalities);
  Object.freeze(descriptor.supportedOutputModalities);
  return Object.freeze(descriptor);
}

function freezeModelDescriptor(descriptor: ModelDescriptor): ModelDescriptor {
  Object.freeze(descriptor.supportedInputModalities);
  Object.freeze(descriptor.supportedOutputModalities);
  return Object.freeze(descriptor);
}

function cloneProviderDescriptor(descriptor: ProviderDescriptor): ProviderDescriptor {
  return freezeProviderDescriptor({
    ...descriptor,
    capabilities: { ...descriptor.capabilities },
    supportedInputModalities: [...descriptor.supportedInputModalities],
    supportedOutputModalities: [...descriptor.supportedOutputModalities],
  });
}

function cloneModelDescriptor(descriptor: ModelDescriptor): ModelDescriptor {
  return freezeModelDescriptor({
    ...descriptor,
    supportedInputModalities: [...descriptor.supportedInputModalities],
    supportedOutputModalities: [...descriptor.supportedOutputModalities],
  });
}

interface RegistryEntry {
  readonly adapter: ModelProviderAdapter;
  readonly descriptor: ProviderDescriptor;
  readonly models: ReadonlyMap<string, ModelDescriptor>;
}

export class ModelProviderRegistry {
  readonly #providers = new Map<string, RegistryEntry>();
  readonly #modelOwners = new Map<string, string>();
  #disposed = false;

  get disposed(): boolean {
    return this.#disposed;
  }

  registerProvider(adapter: ModelProviderAdapter): void {
    this.#assertUsable();

    const descriptor = cloneProviderDescriptor(adapter.descriptor());
    const providerErrors = validateProviderDescriptor(descriptor);

    if (providerErrors.length > 0) {
      throw new RegistryError("invalid_provider", providerErrors.join("; "));
    }
    if (this.#providers.has(descriptor.providerId)) {
      throw new RegistryError(
        "duplicate_provider",
        `Provider '${descriptor.providerId}' is already registered.`,
      );
    }

    const models = new Map<string, ModelDescriptor>();

    for (const candidate of adapter.listModels()) {
      const model = cloneModelDescriptor(candidate);
      const modelErrors = validateModelDescriptor(model);

      if (modelErrors.length > 0) {
        throw new RegistryError("invalid_model", modelErrors.join("; "));
      }
      if (model.providerId !== descriptor.providerId) {
        throw new RegistryError(
          "provider_model_mismatch",
          `Model '${model.modelId}' does not belong to provider '${descriptor.providerId}'.`,
        );
      }
      if (model.executionKind !== descriptor.executionKind) {
        throw new RegistryError(
          "provider_model_mismatch",
          `Model '${model.modelId}' execution kind does not match its provider.`,
        );
      }
      if (models.has(model.modelId) || this.#modelOwners.has(model.modelId)) {
        throw new RegistryError(
          "duplicate_model",
          `Model '${model.modelId}' is already registered.`,
        );
      }

      models.set(model.modelId, model);
    }

    const entry = Object.freeze({
      adapter,
      descriptor,
      models: models as ReadonlyMap<string, ModelDescriptor>,
    });

    this.#providers.set(descriptor.providerId, entry);
    for (const modelId of models.keys()) this.#modelOwners.set(modelId, descriptor.providerId);
  }

  getProvider(providerId: string): ModelProviderAdapter | undefined {
    this.#assertUsable();
    return this.#providers.get(providerId)?.adapter;
  }

  getProviderDescriptor(providerId: string): ProviderDescriptor | undefined {
    this.#assertUsable();
    return this.#providers.get(providerId)?.descriptor;
  }

  getModel(providerId: string, modelId: string): ModelDescriptor | undefined {
    this.#assertUsable();
    return this.#providers.get(providerId)?.models.get(modelId);
  }

  getModelOwner(modelId: string): string | undefined {
    this.#assertUsable();
    return this.#modelOwners.get(modelId);
  }

  snapshot(): readonly RegisteredProviderSnapshot[] {
    this.#assertUsable();

    return Object.freeze(
      [...this.#providers.values()].map((entry) =>
        Object.freeze({
          descriptor: entry.descriptor,
          models: Object.freeze([...entry.models.values()]),
        }),
      ),
    );
  }

  async removeProvider(providerId: string, activeInvocationCount = 0): Promise<boolean> {
    this.#assertUsable();

    if (!Number.isInteger(activeInvocationCount) || activeInvocationCount < 0) {
      throw new RegistryError("provider_active", "Active invocation count is invalid.");
    }
    if (activeInvocationCount > 0) {
      throw new RegistryError(
        "provider_active",
        `Provider '${providerId}' still has active invocations.`,
      );
    }

    const entry = this.#providers.get(providerId);
    if (entry === undefined) return false;

    this.#providers.delete(providerId);
    for (const modelId of entry.models.keys()) this.#modelOwners.delete(modelId);
    await entry.adapter.dispose();
    return true;
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;

    const adapters = [...this.#providers.values()].map((entry) => entry.adapter);
    this.#providers.clear();
    this.#modelOwners.clear();

    await Promise.all(adapters.map(async (adapter) => adapter.dispose()));
  }

  #assertUsable(): void {
    if (this.#disposed) {
      throw new RegistryError("registry_disposed", "The model provider registry is disposed.");
    }
  }
}

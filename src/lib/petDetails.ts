import type { PetDetails } from "@/types/order";

// `prefix` lets the same four field names be read twice under different keys (e.g. "a_furColorNote"
// / "b_furColorNote") -- used by /api/generate-model-duo, which needs one PetDetails per subject
// from a single form submission.
export function readPetDetails(formData: FormData, prefix = ""): PetDetails {
  const asString = (key: string) => {
    const value = formData.get(`${prefix}${key}`);
    return typeof value === "string" && value.trim().length > 0
      ? value
      : undefined;
  };
  return {
    furColorNote: asString("furColorNote"),
    breedNote: asString("breedNote"),
    accessoryNote: asString("accessoryNote"),
    bodyFeatureNote: asString("bodyFeatureNote"),
  };
}

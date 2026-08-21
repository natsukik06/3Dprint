import type { PetDetails } from "@/types/order";

export function readPetDetails(formData: FormData): PetDetails {
  const asString = (key: string) => {
    const value = formData.get(key);
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

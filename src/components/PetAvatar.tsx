import Image from "next/image";

import { PET_BY_ID } from "@/data/pets";
import type { PetId } from "@/types/debate";

interface PetAvatarProps {
  petId: PetId;
  size?: "small" | "medium" | "large";
  showLabel?: boolean;
  className?: string;
}
const pixels = { small: 48, medium: 76, large: 132 } as const;

export function PetAvatar({ petId, size = "medium", showLabel = false, className = "" }: PetAvatarProps) {
  const pet = PET_BY_ID[petId];
  const dimension = pixels[size];
  return (
    <span className={`pet-avatar pet-avatar--${size} ${className}`.trim()}>
      <span className="pet-avatar__image" style={{ backgroundColor: `${pet.color}24` }}>
        <Image src={`/pets/${pet.id}.svg`} alt={`${pet.name} 캐릭터`} width={dimension} height={dimension} priority={size === "large"} />
      </span>
      {showLabel ? (
        <span className="pet-avatar__label">
          <strong>{pet.name}</strong>
          <small>{pet.lens}</small>
        </span>
      ) : null}
    </span>
  );
}

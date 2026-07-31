export interface CircularCollisionBody {
  readonly positionX: number;
  readonly positionY: number;
  readonly radius: number;
}

export function circlesCollide(
  left: Readonly<CircularCollisionBody>,
  right: Readonly<CircularCollisionBody>,
): boolean {
  const distanceX = left.positionX - right.positionX;
  const distanceY = left.positionY - right.positionY;
  const combinedRadius = left.radius + right.radius;

  const distanceSquared = distanceX * distanceX + distanceY * distanceY;
  const combinedRadiusSquared = combinedRadius * combinedRadius;

  if (!Number.isSafeInteger(distanceSquared) || !Number.isSafeInteger(combinedRadiusSquared)) {
    throw new RangeError(
      "Collision squared-distance calculation must remain within safe-integer limits.",
    );
  }

  return distanceSquared <= combinedRadiusSquared;
}

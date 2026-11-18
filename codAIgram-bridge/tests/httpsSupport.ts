export function supportsHttpsFixture(platform: NodeJS.Platform): boolean {
    return platform !== "linux";
}

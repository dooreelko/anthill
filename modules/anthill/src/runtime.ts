export const runtimeRegistry = () => {
    const theGlobe = global as any as { runtimeRegistry: Map<string, () => void> };

    if (!theGlobe.runtimeRegistry) {
        theGlobe.runtimeRegistry = new Map<string, () => void>;
    }

    return theGlobe.runtimeRegistry;
};

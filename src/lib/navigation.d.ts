declare global {
    const navigation: Navigation;

    interface Navigation {
        __eventMap?: NavigationEventMap;
    }
}

export {};

declare global {
    const navigation: Navigation;

    interface Navigation {
        __eventMap?: NavigationEventMap;
    }

    interface NavigationInterceptOptions {
        precommitHandler?: () => Promise<void>;
    }

    interface NavigateEvent {
        readonly cancelable: boolean;
    }
}

export {};

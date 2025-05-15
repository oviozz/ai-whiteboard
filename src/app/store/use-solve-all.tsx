
"use client";
import { create } from 'zustand';

type StoreState = {
    open: boolean;
    isLoading: boolean;
    setOpen: (val: boolean) => void;
    setIsLoading: (status: boolean) => void;
};

const useSolveAll = create<StoreState>((set) => ({
    open: false,
    isLoading: false,
    setOpen: (val) =>
        set(() => ({
            open: val,
        })),
    setIsLoading: (status) =>
        set(() => ({
            isLoading: status,
        })),
}));

export default useSolveAll;

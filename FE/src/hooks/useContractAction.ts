import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';

interface TxState {
  isLoading: boolean;
  error: string | null;
  txHash: string | null;
}

/**
 * Hook for managing contract transaction states
 */
export function useContractAction() {
  const [state, setState] = useState<TxState>({
    isLoading: false,
    error: null,
    txHash: null,
  });

  const execute = useCallback(
    async <T>(
      action: () => Promise<T>,
      options?: {
        onSuccess?: (result: T) => void;
        successMessage?: string;
        errorMessage?: string;
      }
    ): Promise<T | null> => {
      setState({ isLoading: true, error: null, txHash: null });
      try {
        const result = await action();

        // If result has a hash property (ethers transaction), wait for it
        const txResult = result as any;
        if (txResult?.hash) {
          setState(prev => ({ ...prev, txHash: txResult.hash }));
          toast.loading('Đang xử lý giao dịch...', { id: 'tx' });
          await txResult.wait();
          toast.dismiss('tx');
        }

        setState({ isLoading: false, error: null, txHash: txResult?.hash ?? null });
        if (options?.successMessage) {
          toast.success(options.successMessage);
        }
        options?.onSuccess?.(result);
        return result;
      } catch (err: any) {
        const message = err?.reason || err?.message || 'Transaction failed';
        setState({ isLoading: false, error: message, txHash: null });
        toast.error(options?.errorMessage || message);
        return null;
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState({ isLoading: false, error: null, txHash: null });
  }, []);

  return { ...state, execute, reset };
}

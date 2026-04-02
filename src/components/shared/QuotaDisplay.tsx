/**
 * @file QuotaDisplay.tsx
 * @description Displays the user's API credit quota.
 * @dependencies ../../config/firebase.ts, ../../types/index.ts
 * @exports QuotaDisplay
 */

import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth, handleFirestoreError } from '../../config/firebase';
import { OperationType } from '../../types/index';

const QuotaDisplay = () => {
    const [quota, setQuota] = useState<number | null>(null);

    useEffect(() => {
        if (!auth.currentUser) return;

        const quotaRef = doc(db, 'users', auth.currentUser.uid);
        const unsubscribe = onSnapshot(quotaRef, (doc) => {
            if (doc.exists()) {
                setQuota(doc.data().apiCredits || 0);
            } else {
                setQuota(0);
            }
        }, (error) => {
            handleFirestoreError(error, OperationType.GET, `users/${auth.currentUser?.uid}`);
        });

        return () => unsubscribe();
    }, []);

    if (quota === null) return (
        <div className="quota-display" style={{ padding: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Kredi yükleniyor...
        </div>
    );

    return (
        <div className="quota-display" style={{ padding: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Kalan API Kredisi: {quota}
        </div>
    );
};

export default QuotaDisplay;

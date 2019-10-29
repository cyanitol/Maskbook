/// <reference path="../global.d.ts" />

import { OnlyRunInContext } from '@holoflows/kit/es'
import { PersonIdentifier, CryptoIDIdentifier, Identifier, ECKeyIdentifier } from '../type'
import { DBSchema, openDB, IDBPDatabase } from 'idb/with-async-ittr'
/**
 * Database structure:
 *
 * # ObjectStore `self`:
 * @description Store self CryptoIDs.
 * @type {CryptoIDRecordDb}
 * @keys inline, {@link CryptoIDRecordDb.identifier}
 *
 * # ObjectStore `others`:
 * @description Store others CryptoIDs.
 * @type {CryptoIDRecordDb}
 * @keys inline, {@link CryptoIDRecordDb.identifier}
 *
 * # ObjectStore `profiles`:
 * @description Store profiles.
 * @type {ProfileRecord}
 * A person links to 0 or more profiles.
 * Each profile links to 0 or 1 CryptoIDs.
 * @keys inline, {@link ProfileRecord.identifier}
 */

OnlyRunInContext('background', 'CryptoID db')

const db = (function() {
    let db: IDBPDatabase<CryptoID_DB> = undefined as any
    return async () => {
        if (typeof db === 'undefined')
            return openDB<CryptoID_DB>('maskbook-crypto-id', 1, {
                upgrade(db, oldVersion, newVersion, transaction) {
                    function v0_v1() {
                        db.createObjectStore('self', { keyPath: 'identifier' })
                        db.createObjectStore('others', { keyPath: 'identifier' })
                        db.createObjectStore('profiles', { keyPath: 'identifier' })
                        transaction.objectStore('profiles').createIndex('network', 'network', { unique: false })
                    }
                    if (oldVersion < 1) v0_v1()
                },
            }).then(x => (db = x))
        else return db
    }
})()

//#region Plain methods
/**
 * Create a new CryptoID.
 * If the record contains `privateKey`, it will be stored in the `self` store.
 * Otherwise, it will be stored in the `others` store.
 */
declare function createCryptoID_DB(record: CryptoIDRecord): Promise<void>

/**
 * Query a CryptoID.
 */
declare function queryCryptoID_DB(
    id: CryptoIDIdentifier | ((record: CryptoIDRecord) => boolean),
): Promise<CryptoIDRecord>

/**
 * Update an existing CryptoID record.
 *
 * If the `record` contains `privateKey` but the object is stored in the `others` previously,
 * this will move the CryptoID to the `self` store.
 *
 * @param record The partial record to be merged
 */
declare function updateCryptoID_DB(
    record: Partial<CryptoIDRecord> & Pick<CryptoIDRecord, 'identifier'>,
    mode: 'append' | 'overwrite',
): Promise<void>

/**
 * Delete a CryptoID
 */
declare function deleteCryptoID_DB(id: CryptoIDIdentifier): Promise<void>

/**
 * Create a new profile.
 */
declare function createProfileDB(record: ProfileRecord): Promise<void>

/**
 * Query a profile.
 */
declare function queryProfileDB(id: PersonIdentifier | ((record: PersonIdentifier) => boolean)): Promise<ProfileRecord>

/**
 * Update a profile.
 */
declare function updateProfileDB(record: Partial<ProfileRecord> & Pick<ProfileRecord, 'identifier'>): Promise<void>

/**
 * Delete a profile
 */
declare function deleteProfileDB(id: PersonIdentifier): Promise<void>

//#endregion

//#region Type
interface ProfileRecord {
    identifier: PersonIdentifier
    nickname?: string
    localKey?: CryptoKey
    linkedCryptoID?: CryptoIDIdentifier
    createdAt: Date
    updatedAt: Date
}

interface CryptoIDRecord {
    identifier: CryptoIDIdentifier
    publicKey: CryptoKey
    privateKey?: CryptoKey
    localKey?: CryptoKey
    nickname: string
    attachedProfiles: Set<PersonIdentifier>
    createdAt: Date
    updatedAt: Date
}
type ProfileRecordDb = Omit<ProfileRecord, 'identifier'> & { identifier: string }
type CryptoIDRecordDb = Omit<CryptoIDRecord, 'identifier'> & { identifier: string }

interface CryptoID_DB extends DBSchema {
    /** Use inline keys */
    self: {
        value: CryptoIDRecordDb
        key: string
    }
    /** Use inline keys */
    others: {
        value: CryptoIDRecordDb
        key: string
    }
    profiles: {
        value: ProfileRecord
        key: string
        indexes: {
            // Use `network` field as index
            network: string
        }
    }
}
//#endregion

//#region out db & to db
function profileIn(x: ProfileRecord): ProfileRecordDb {
    return {
        ...x,
        identifier: x.identifier.toText(),
    }
}
function profileOut(x: ProfileRecordDb): ProfileRecord {
    if (x.linkedCryptoID) {
        if (x.linkedCryptoID.type === 'ec_key') Object.setPrototypeOf(x.linkedCryptoID, ECKeyIdentifier.prototype)
        else throw new Error('Unknown type of linkedCryptoID')
    }
    return { ...x, identifier: Identifier.fromString(x.identifier) as PersonIdentifier }
}
function cryptoKeyRecordIn(x: CryptoIDRecord): CryptoIDRecordDb {
    return {
        ...x,
        identifier: x.identifier.toText(),
    }
}
function cryptoKeyRecordOut(x: CryptoIDRecordDb): CryptoIDRecord {
    for (const each of x.attachedProfiles) {
        Object.setPrototypeOf(each, PersonIdentifier.prototype)
    }
    return { ...x, identifier: Identifier.fromString(x.identifier) as CryptoIDIdentifier }
}
//#endregion

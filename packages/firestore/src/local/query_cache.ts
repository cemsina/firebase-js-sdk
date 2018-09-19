/**
 * Copyright 2017 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Query } from '../core/query';
import { SnapshotVersion } from '../core/snapshot_version';
import { ListenSequenceNumber, TargetId } from '../core/types';
import { DocumentKeySet } from '../model/collections';

import { GarbageSource } from './garbage_source';
import { PersistenceTransaction } from './persistence';
import { PersistencePromise } from './persistence_promise';
import { QueryData } from './query_data';

/**
 * Represents cached queries received from the remote backend.
 *
 * The cache is keyed by Query and entries in the cache are QueryData instances.
 */
export interface QueryCache extends GarbageSource {
  /**
   * A global snapshot version representing the last consistent snapshot we
   * received from the backend. This is monotonically increasing and any
   * snapshots received from the backend prior to this version (e.g. for targets
   * resumed with a resume_token) should be suppressed (buffered) until the
   * backend has caught up to this snapshot version again. This prevents our
   * cache from ever going backwards in time.
   *
   * This is updated whenever our we get a TargetChange with a read_time and
   * empty target_ids.
   */
  getLastRemoteSnapshotVersion(
    transaction: PersistenceTransaction
  ): PersistencePromise<SnapshotVersion>;

  /**
   * @return The highest sequence number observed, including any that might be
   *         persisted on-disk.
   */
  getHighestSequenceNumber(
    transaction: PersistenceTransaction
  ): PersistencePromise<ListenSequenceNumber>;

  /**
   * Call provided function with each `QueryData` that we have cached.
   */
  forEachTarget(
    txn: PersistenceTransaction,
    f: (q: QueryData) => void
  ): PersistencePromise<void>;

  /**
   * Set the highest listen sequence number and optionally updates the
   * snapshot version of the last consistent snapshot received from the backend
   * (see getLastRemoteSnapshotVersion() for more details).
   *
   * @param highestListenSequenceNumber The new maximum listen sequence number.
   * @param lastRemoteSnapshotVersion The new snapshot version. Optional.
   */
  setTargetsMetadata(
    transaction: PersistenceTransaction,
    highestListenSequenceNumber: number,
    lastRemoteSnapshotVersion?: SnapshotVersion
  ): PersistencePromise<void>;

  /**
   * Adds an entry in the cache.
   *
   * The cache key is extracted from `queryData.query`. The key must not already
   * exist in the cache.
   *
   * @param queryData A QueryData instance to put in the cache.
   */
  addQueryData(
    transaction: PersistenceTransaction,
    queryData: QueryData
  ): PersistencePromise<void>;

  /**
   * Updates an entry in the cache.
   *
   * The cache key is extracted from `queryData.query`. The entry must already
   * exist in the cache, and it will be replaced.
   * @param {QueryData} queryData The QueryData to be replaced into the cache.
   */
  updateQueryData(
    transaction: PersistenceTransaction,
    queryData: QueryData
  ): PersistencePromise<void>;

  /**
   * Removes the cached entry for the given query data. It is an error to remove
   * a query data that does not exist.
   *
   * Multi-Tab Note: This operation should only be called by the primary client.
   */
  removeQueryData(
    transaction: PersistenceTransaction,
    queryData: QueryData
  ): PersistencePromise<void>;

  /**
   * The number of targets currently in the cache.
   */
  // Visible for testing.
  getQueryCount(
    transaction: PersistenceTransaction
  ): PersistencePromise<number>;

  /**
   * Looks up a QueryData entry by query.
   *
   * @param query The query corresponding to the entry to look up.
   * @return The cached QueryData entry, or null if the cache has no entry for
   * the query.
   */
  getQueryData(
    transaction: PersistenceTransaction,
    query: Query
  ): PersistencePromise<QueryData | null>;

  /**
   * Looks up a QueryData entry by target ID.
   *
   * @param targetId The target ID of the QueryData entry to look up.
   * @return The cached QueryData entry, or null if the cache has no entry for
   * the query.
   */
  // PORTING NOTE: Multi-tab only.
  getQueryDataForTarget(
    txn: PersistenceTransaction,
    targetId: TargetId
  ): PersistencePromise<QueryData | null>;

  /**
   * Adds the given document keys to cached query results of the given target
   * ID.
   *
   * Multi-Tab Note: This operation should only be called by the primary client.
   */
  addMatchingKeys(
    transaction: PersistenceTransaction,
    keys: DocumentKeySet,
    targetId: TargetId
  ): PersistencePromise<void>;

  /**
   * Removes the given document keys from the cached query results of the
   * given target ID.
   *
   * Multi-Tab Note: This operation should only be called by the primary client.
   */
  removeMatchingKeys(
    transaction: PersistenceTransaction,
    keys: DocumentKeySet,
    targetId: TargetId
  ): PersistencePromise<void>;

  /**
   * Removes all the keys in the query results of the given target ID.
   *
   * Multi-Tab Note: This operation should only be called by the primary client.
   */
  removeMatchingKeysForTargetId(
    transaction: PersistenceTransaction,
    targetId: TargetId
  ): PersistencePromise<void>;

  /**
   * Returns the document keys that match the provided target ID.
   */
  getMatchingKeysForTargetId(
    transaction: PersistenceTransaction,
    targetId: TargetId
  ): PersistencePromise<DocumentKeySet>;

  /**
   * Returns a new target ID that is higher than any query in the cache. If
   * there are no queries in the cache, returns the first valid target ID.
   * Allocated target IDs are persisted and `allocateTargetId()` will never
   * return the same ID twice.
   */
  allocateTargetId(
    transaction: PersistenceTransaction
  ): PersistencePromise<TargetId>;
}

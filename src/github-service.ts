import type { getOctokit } from "@actions/github";
import type { Env, GitHubService, Pull } from "./interfaces";

type Octokit = ReturnType<typeof getOctokit>;

// Review states whose presence implies a past reviewer we should not re-pick.
// GitHub removes the reviewer from requested_reviewers in all three cases —
// APPROVED (active approval), CHANGES_REQUESTED (blocking review), and
// DISMISSED (post-rebase stale-dismiss, where the entry stays in listReviews
// with state mutated to DISMISSED). COMMENTED is excluded — those reviewers
// stay in requested_reviewers and would otherwise be double-counted.
const COUNTED_REVIEW_STATES: ReadonlySet<string> = new Set([
  "APPROVED",
  "CHANGES_REQUESTED",
  "DISMISSED",
]);

export class GitHubServiceImpl implements GitHubService {
  private octokit: Octokit;
  private env: Env;

  constructor(octokit: Octokit, env: Env) {
    this.octokit = octokit;
    this.env = env;
  }

  async setReviewers(prNumber: number, reviewers: string[]): Promise<object> {
    const ownerAndRepo = this.getOwnerAndRepo();

    return this.octokit.rest.pulls.requestReviewers({
      ...ownerAndRepo,
      pull_number: prNumber,
      reviewers: reviewers.filter((r: string | undefined) => !!r),
    });
  }

  async getExistingReviewers(prNumber: number): Promise<string[]> {
    const ownerAndRepo = this.getOwnerAndRepo();

    // GitHub removes a reviewer from listRequestedReviewers once they submit
    // a review, so union with listReviews to keep past reviewers (incl.
    // stale-dismissed ones) out of the lottery.
    //
    // Use allSettled so a transient listReviews failure degrades to the
    // pre-patch behavior (requested-only) rather than discarding the
    // successful requested call and re-eligibling currently-pending reviewers.
    const [requestedResult, reviewsResult] = await Promise.allSettled([
      this.octokit.rest.pulls.listRequestedReviewers({
        ...ownerAndRepo,
        pull_number: prNumber,
      }),
      this.octokit.paginate(this.octokit.rest.pulls.listReviews, {
        ...ownerAndRepo,
        pull_number: prNumber,
        per_page: 100,
      }),
    ]);

    if (requestedResult.status === "rejected") {
      const reason = requestedResult.reason;
      throw new Error(
        `Failed to get existing reviewers: ${reason instanceof Error ? reason.message : String(reason)}`,
      );
    }

    const reviewers = new Set<string>(
      requestedResult.value.data.users.map(
        (user: { login: string }) => user.login,
      ),
    );

    if (reviewsResult.status === "fulfilled") {
      for (const review of reviewsResult.value) {
        const login = review.user?.login;
        if (login && COUNTED_REVIEW_STATES.has(review.state)) {
          reviewers.add(login);
        }
      }
    }

    return [...reviewers];
  }

  async getPRAuthor(prNumber: number): Promise<string> {
    const ownerAndRepo = this.getOwnerAndRepo();

    try {
      const { data } = await this.octokit.rest.pulls.get({
        ...ownerAndRepo,
        pull_number: prNumber,
      });

      return data.user?.login ?? "";
    } catch (error: unknown) {
      throw new Error(
        `Failed to get PR author: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async findPRByRef(ref: string): Promise<Pull | undefined> {
    const ownerAndRepo = this.getOwnerAndRepo();

    try {
      const { data } = await this.octokit.rest.pulls.list({
        ...ownerAndRepo,
      });

      const pr = data.find(
        ({ head: { ref: prRef } }: { head: { ref: string } }) => prRef === ref,
      );

      if (!pr) {
        throw new Error(`PR matching ref not found: ${ref}`);
      }

      return {
        number: pr.number,
        user: pr.user,
      };
    } catch (error: unknown) {
      throw new Error(
        `Failed to find PR by ref: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private getOwnerAndRepo(): { owner: string; repo: string } {
    const [owner, repo] = this.env.repository.split("/");

    return { owner, repo };
  }
}

import { GitHubServiceImpl } from "../../src/github-service";

// GitHubServiceImpl's constructor only needs an object matching the
// Octokit shape it actually calls (rest.pulls.*, paginate) — the real
// @actions/github package is never loaded, so these tests exercise the
// real getExistingReviewers logic without needing a real Octokit/HTTP layer.
const createFakeOctokit = (
  overrides: { listRequestedReviewers?: jest.Mock; paginate?: jest.Mock } = {},
) => ({
  rest: {
    pulls: {
      listRequestedReviewers:
        overrides.listRequestedReviewers ??
        jest.fn().mockResolvedValue({ data: { users: [] } }),
      listReviews: jest.fn(),
    },
  },
  paginate: overrides.paginate ?? jest.fn().mockResolvedValue([]),
});

const ENV = { repository: "owner/repo", ref: "refs/heads/feature" };

describe("GitHubServiceImpl.getExistingReviewers", () => {
  test("includes a commented-only reviewer even when absent from requested_reviewers", async () => {
    const octokit = createFakeOctokit({
      listRequestedReviewers: jest
        .fn()
        .mockResolvedValue({ data: { users: [] } }),
      paginate: jest
        .fn()
        .mockResolvedValue([{ user: { login: "bob" }, state: "COMMENTED" }]),
    });

    const result = await new GitHubServiceImpl(
      octokit as never,
      ENV,
    ).getExistingReviewers(1);

    expect(result).toEqual(["bob"]);
  });

  test("dedupes a reviewer present in both requested_reviewers and listReviews", async () => {
    const octokit = createFakeOctokit({
      listRequestedReviewers: jest
        .fn()
        .mockResolvedValue({ data: { users: [{ login: "bob" }] } }),
      paginate: jest
        .fn()
        .mockResolvedValue([{ user: { login: "bob" }, state: "APPROVED" }]),
    });

    const result = await new GitHubServiceImpl(
      octokit as never,
      ENV,
    ).getExistingReviewers(1);

    expect(result).toEqual(["bob"]);
  });

  test("falls back to requested_reviewers only when listReviews rejects", async () => {
    const octokit = createFakeOctokit({
      listRequestedReviewers: jest
        .fn()
        .mockResolvedValue({ data: { users: [{ login: "alice" }] } }),
      paginate: jest.fn().mockRejectedValue(new Error("boom")),
    });

    const result = await new GitHubServiceImpl(
      octokit as never,
      ENV,
    ).getExistingReviewers(1);

    expect(result).toEqual(["alice"]);
  });

  test("throws when listRequestedReviewers rejects", async () => {
    const octokit = createFakeOctokit({
      listRequestedReviewers: jest
        .fn()
        .mockRejectedValue(new Error("not found")),
    });

    await expect(
      new GitHubServiceImpl(octokit as never, ENV).getExistingReviewers(1),
    ).rejects.toThrow("Failed to get existing reviewers");
  });
});

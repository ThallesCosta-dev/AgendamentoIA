import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  formatDateBR,
  getAllowedEmailDomains,
  institutionalEmailErrorMessage,
  isValidDateFormat,
  maskEmail,
  normalizeTimeToHHMM,
  timeRangesOverlap,
  timeToMinutes,
  validateDate,
  validateInstitutionalEmail,
  validateTime,
  validateTimeRange,
} from "./validation";

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

describe("isValidDateFormat", () => {
  it("accepts valid YYYY-MM-DD calendar dates", () => {
    expect(isValidDateFormat("2030-01-15")).toBe(true);
    expect(isValidDateFormat("2030-12-31")).toBe(true);
    expect(isValidDateFormat("2028-02-29")).toBe(true); // leap year
  });

  it("rejects malformed or impossible dates", () => {
    expect(isValidDateFormat("15-01-2030")).toBe(false); // DD-MM-YYYY
    expect(isValidDateFormat("2030/01/15")).toBe(false);
    expect(isValidDateFormat("2030-13-01")).toBe(false); // month 13
    expect(isValidDateFormat("2030-02-30")).toBe(false); // Feb 30
    expect(isValidDateFormat("2027-02-29")).toBe(false); // not a leap year
    expect(isValidDateFormat("")).toBe(false);
    expect(isValidDateFormat("abc")).toBe(false);
  });
});

describe("validateDate", () => {
  it("accepts today and future dates", () => {
    const today = new Date();
    expect(validateDate(toISODate(today))).toBe(true);

    const future = new Date();
    future.setDate(future.getDate() + 30);
    expect(validateDate(toISODate(future))).toBe(true);
  });

  it("rejects past dates", () => {
    const past = new Date();
    past.setDate(past.getDate() - 1);
    expect(validateDate(toISODate(past))).toBe(false);
    expect(validateDate("2020-01-01")).toBe(false);
  });

  it("rejects invalid formats", () => {
    expect(validateDate("31/12/2099")).toBe(false);
    expect(validateDate("2099-2-1")).toBe(false);
  });
});

describe("validateTime (HH:MM)", () => {
  it("accepts valid times", () => {
    expect(validateTime("00:00")).toBe(true);
    expect(validateTime("09:30")).toBe(true);
    expect(validateTime("23:59")).toBe(true);
  });

  it("rejects invalid times", () => {
    expect(validateTime("24:00")).toBe(false);
    expect(validateTime("12:60")).toBe(false);
    expect(validateTime("9:30")).toBe(false); // must be two digits
    expect(validateTime("12:00:00")).toBe(false); // seconds not allowed in input
    expect(validateTime("noon")).toBe(false);
    expect(validateTime("")).toBe(false);
  });
});

describe("validateTimeRange", () => {
  it("requires end after start", () => {
    expect(validateTimeRange("09:00", "10:00")).toBe(true);
    expect(validateTimeRange("10:00", "10:00")).toBe(false);
    expect(validateTimeRange("11:00", "10:00")).toBe(false);
  });
});

describe("timeToMinutes / normalizeTimeToHHMM", () => {
  it("converts HH:MM and HH:MM:SS to minutes since midnight", () => {
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("09:30")).toBe(570);
    expect(timeToMinutes("14:00:00")).toBe(840); // DB TIME format
    expect(timeToMinutes("23:59")).toBe(1439);
  });

  it("returns NaN for invalid inputs", () => {
    expect(Number.isNaN(timeToMinutes("abc"))).toBe(true);
    expect(Number.isNaN(timeToMinutes("25:00"))).toBe(true);
  });

  it("normalizes DB times to HH:MM", () => {
    expect(normalizeTimeToHHMM("14:00:00")).toBe("14:00");
    expect(normalizeTimeToHHMM("9:05")).toBe("09:05");
    expect(normalizeTimeToHHMM("14:30")).toBe("14:30");
  });
});

describe("timeRangesOverlap", () => {
  it("detects overlapping ranges", () => {
    expect(timeRangesOverlap("09:00", "11:00", "10:00", "12:00")).toBe(true);
    expect(timeRangesOverlap("10:00", "12:00", "09:00", "11:00")).toBe(true);
    expect(timeRangesOverlap("09:00", "12:00", "10:00", "11:00")).toBe(true); // contained
  });

  it("treats abutting slots as NOT overlapping", () => {
    expect(timeRangesOverlap("09:00", "10:00", "10:00", "11:00")).toBe(false);
    expect(timeRangesOverlap("10:00", "11:00", "09:00", "10:00")).toBe(false);
  });

  it("handles mixed HH:MM and HH:MM:SS formats (DB vs request)", () => {
    // Bug histórico: comparação lexicográfica "10:00:00" < "10:00" falhava
    expect(timeRangesOverlap("09:00:00", "10:00:00", "10:00", "11:00")).toBe(
      false,
    );
    expect(timeRangesOverlap("09:00:00", "10:30:00", "10:00", "11:00")).toBe(
      true,
    );
  });

  it("returns false for disjoint ranges", () => {
    expect(timeRangesOverlap("08:00", "09:00", "10:00", "11:00")).toBe(false);
  });
});

describe("validateInstitutionalEmail", () => {
  const domains = ["fiocruz.br", "edu.br"];

  it("accepts exact allowed domains", () => {
    expect(validateInstitutionalEmail("pessoa@fiocruz.br", domains)).toBe(true);
  });

  it("accepts subdomains of allowed domains (ioc.fiocruz.br)", () => {
    expect(
      validateInstitutionalEmail("pesquisador@ioc.fiocruz.br", domains),
    ).toBe(true);
    expect(
      validateInstitutionalEmail("aluno@universidade.edu.br", domains),
    ).toBe(true);
  });

  it("rejects non-institutional domains", () => {
    expect(validateInstitutionalEmail("alguem@gmail.com", domains)).toBe(false);
    expect(validateInstitutionalEmail("alguem@fiocruz.br.evil.com", domains)).toBe(
      false,
    );
    // "notfiocruz.br" não é subdomínio de fiocruz.br
    expect(validateInstitutionalEmail("x@notfiocruz.br", domains)).toBe(false);
  });

  it("rejects malformed emails", () => {
    expect(validateInstitutionalEmail("not-an-email", domains)).toBe(false);
    expect(validateInstitutionalEmail("a b@fiocruz.br", domains)).toBe(false);
    expect(validateInstitutionalEmail("", domains)).toBe(false);
  });

  it("is case-insensitive on the domain", () => {
    expect(validateInstitutionalEmail("pessoa@IOC.FIOCRUZ.BR", domains)).toBe(
      true,
    );
  });

  it("uses the default domain list when none is provided", () => {
    const previous = process.env.ALLOWED_EMAIL_DOMAINS;
    delete process.env.ALLOWED_EMAIL_DOMAINS;
    try {
      expect(getAllowedEmailDomains()).toEqual(["fiocruz.br", "edu.br"]);
      expect(validateInstitutionalEmail("pessoa@ioc.fiocruz.br")).toBe(true);
      expect(validateInstitutionalEmail("pessoa@gmail.com")).toBe(false);
    } finally {
      if (previous !== undefined) process.env.ALLOWED_EMAIL_DOMAINS = previous;
    }
  });

  it("reads ALLOWED_EMAIL_DOMAINS from the environment", () => {
    const previous = process.env.ALLOWED_EMAIL_DOMAINS;
    process.env.ALLOWED_EMAIL_DOMAINS = "exemplo.br, outro.org";
    try {
      expect(getAllowedEmailDomains()).toEqual(["exemplo.br", "outro.org"]);
      expect(validateInstitutionalEmail("a@sub.exemplo.br")).toBe(true);
      expect(validateInstitutionalEmail("a@fiocruz.br")).toBe(false);
      expect(institutionalEmailErrorMessage()).toContain("exemplo.br");
    } finally {
      if (previous !== undefined) {
        process.env.ALLOWED_EMAIL_DOMAINS = previous;
      } else {
        delete process.env.ALLOWED_EMAIL_DOMAINS;
      }
    }
  });

  it("tolerates leading dots in configured domains (.edu.br == edu.br)", () => {
    const previous = process.env.ALLOWED_EMAIL_DOMAINS;
    process.env.ALLOWED_EMAIL_DOMAINS = "fiocruz.br,ioc.fiocruz.br,.edu.br";
    try {
      expect(getAllowedEmailDomains()).toEqual([
        "fiocruz.br",
        "ioc.fiocruz.br",
        "edu.br",
      ]);
      expect(validateInstitutionalEmail("aluno@usp.edu.br")).toBe(true);
      expect(validateInstitutionalEmail("a@ioc.fiocruz.br")).toBe(true);
      expect(validateInstitutionalEmail("x@gmail.com")).toBe(false);
    } finally {
      if (previous !== undefined) {
        process.env.ALLOWED_EMAIL_DOMAINS = previous;
      } else {
        delete process.env.ALLOWED_EMAIL_DOMAINS;
      }
    }
  });
});

describe("maskEmail", () => {
  it("keeps the first 2 chars of the local part and the full domain", () => {
    expect(maskEmail("thalles.costa@ioc.fiocruz.br")).toBe(
      "th***@ioc.fiocruz.br",
    );
    expect(maskEmail("pessoa@fiocruz.br")).toBe("pe***@fiocruz.br");
  });

  it("handles short local parts", () => {
    expect(maskEmail("ab@fiocruz.br")).toBe("ab***@fiocruz.br");
    expect(maskEmail("a@fiocruz.br")).toBe("a***@fiocruz.br");
  });

  it("handles malformed inputs without throwing", () => {
    expect(maskEmail("")).toBe("");
    expect(maskEmail("not-an-email")).toBe("***");
    expect(maskEmail(undefined as unknown as string)).toBe("");
    expect(maskEmail(null as unknown as string)).toBe("");
  });
});

describe("escapeHtml", () => {
  it("escapes HTML special characters", () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
    expect(escapeHtml("a & b")).toBe("a &amp; b");
    expect(escapeHtml("it's")).toBe("it&#39;s");
  });

  it("stringifies non-string values and handles null/undefined", () => {
    expect(escapeHtml(42)).toBe("42");
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
});

describe("formatDateBR", () => {
  it("formats YYYY-MM-DD in the LOCAL timezone (no previous-day bug)", () => {
    // Em UTC-3, new Date("2026-03-10") seria 9 de março — o helper deve
    // sempre retornar o dia 10.
    const formatted = formatDateBR("2026-03-10");
    expect(formatted).toContain("10");
    expect(formatted.toLowerCase()).toContain("março");
    expect(formatted).toContain("2026");
  });

  it("returns the input unchanged for unrecognized values", () => {
    expect(formatDateBR("not-a-date")).toBe("not-a-date");
  });
});
